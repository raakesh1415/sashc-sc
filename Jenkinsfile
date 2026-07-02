pipeline {
    agent any

    // ── Docker-in-Docker note ────────────────────────────────────────────
    // The docker commands below run against a Docker daemon. Your Jenkins
    // agent must provide one, via EITHER:
    //   (a) a docker:dind sidecar service (true Docker-in-Docker), OR
    //   (b) the host socket mounted into the agent: -v /var/run/docker.sock
    // This is configured at the agent/Jenkins level (Task A3).
    // ─────────────────────────────────────────────────────────────────────

    environment {
        DOCKER_IMAGE  = "raakesh1415/sashc-app"
        // Target host/port for JMeter performance tests (Task A6).
        // Point these at a running staging/dev server before the pipeline runs.
        JMETER_HOST   = 'localhost'
        JMETER_PORT   = '8000'
        JMETER_YEAR   = '2026'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                // Materialise the .env files from Jenkins "Secret file" credentials
                // into the workspace. The container stages (reuseNode true) and the
                // Docker build context then see them; they're never committed to git.
                //   backend/.env  -> read at runtime by python-decouple
                //   frontend/.env -> auto-loaded by Vite at build time (VITE_* vars)
                withCredentials([
                    file(credentialsId: 'backend-env',  variable: 'BACKEND_ENV'),
                    file(credentialsId: 'frontend-env', variable: 'FRONTEND_ENV')
                ]) {
                    sh '''
                        cp -f "$BACKEND_ENV"  backend/.env
                        cp -f "$FRONTEND_ENV" frontend/.env
                    '''
                }
                script {
                    // Short commit SHA used to tag the Docker image (Task A7)
                    env.GIT_SHA = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    echo "Building commit ${env.GIT_SHA}"
                }
            }
        }

        stage('Build Backend') {
            agent {
                docker {
                    image 'python:3.12-slim'
                    // HOME=/tmp gives the non-root container user a writable home
                    // so pip's --user install has somewhere to go.
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                echo 'Building Django backend...'
                sh '''
                    cd backend
                    python -m pip install --user --no-cache-dir -r requirements.txt
                    python manage.py collectstatic --noinput
                '''
            }
        }

        stage('Build Frontend') {
            agent {
                docker {
                    image 'node:20-alpine'
                    // HOME=/tmp so npm can write its cache (~/.npm).
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                echo 'Building React frontend...'
                sh '''
                    cd frontend
                    npm install
                    npm run build
                '''
            }
        }

        stage('Lint') {
            steps {
                echo 'Running Django (flake8) linting...'
                script {
                    docker.image('python:3.12-slim').inside('-e HOME=/tmp') {
                        sh '''
                            cd backend
                            python -m pip install --user --no-cache-dir flake8
                            # F = real errors (undefined names, unused imports),
                            # E9 = syntax errors. No PEP8 style checks.
                            python -m flake8 . --select=F,E9 --exclude=migrations,settings.py,deployment_settings.py,tests.py
                        '''
                    }
                }
                echo 'Running React (ESLint) linting...'
                script {
                    docker.image('node:20-alpine').inside('-e HOME=/tmp') {
                        sh '''
                            cd frontend
                            npm install
                            npx eslint src
                        '''
                    }
                }
            }
        }

        stage('Test') {
            agent {
                docker {
                    image 'python:3.12-slim'
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                echo 'Running Django unit tests (minimum 3 test cases)...'
                sh '''
                    cd backend
                    python -m pip install --user --no-cache-dir -r requirements.txt
                    python manage.py test sashcapp.tests --keepdb
                '''
            }
        }

        stage('Performance Test (JMeter)') {
            environment {
                JMETER_VERSION = '5.6.3'
                JMETER_HOME    = '/tmp/apache-jmeter-5.6.3'
            }
            steps {
                echo 'Running JMeter performance tests inside a Python container...'
                // The test plan logs in to obtain a JWT, so it needs valid
                // credentials. Add a Jenkins "Username with password" credential
                // 'jmeter-creds' where username = a seeded user's email and
                // password = that user's password.
                withCredentials([usernamePassword(
                    credentialsId: 'jmeter-creds',
                    usernameVariable: 'JMETER_EMAIL',
                    passwordVariable: 'JMETER_PASS'
                )]) {
                    script {
                        // Jenkins mounts the workspace into this container automatically.
                        docker.image('python:3.12-slim').inside('-e HOME=/tmp') {
                            sh '''
                                set -e

                                # 1. System deps: curl (downloads) + a JRE (runs JMeter).
                                echo "Installing curl and OpenJDK..."
                                apt-get update -y
                                apt-get install -y --no-install-recommends curl openjdk-17-jre-headless

                                # 2. Download & extract Apache JMeter itself. This step was
                                #    missing before, so ${JMETER_HOME}/bin/jmeter never existed.
                                if [ ! -x "${JMETER_HOME}/bin/jmeter" ]; then
                                    echo "Downloading Apache JMeter ${JMETER_VERSION}..."
                                    curl -sSL "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz" -o /tmp/jmeter.tgz
                                    tar -xzf /tmp/jmeter.tgz -C /tmp
                                fi

                                # 3. Bring up the Django app under test from the workspace code.
                                cd backend
                                python -m pip install --user --no-cache-dir -r requirements.txt
                                python manage.py migrate --noinput
                                echo "Starting Django server..."
                                python manage.py runserver 0.0.0.0:8000 > django_server.log 2>&1 &
                                cd ..

                                # 4. Wait until Django actually answers before load-testing.
                                echo "Waiting for Django to come up..."
                                for i in $(seq 1 30); do
                                    if curl -sf "http://127.0.0.1:8000/api/sashc/" >/dev/null 2>&1; then
                                        echo "Django is up."
                                        break
                                    fi
                                    sleep 2
                                done

                                # 5. Clear old reports and run the load test.
                                rm -rf tests/jmeter-report tests/results.jtl
                                echo "Executing load tests..."
                                "${JMETER_HOME}/bin/jmeter" -n \
                                  -t tests/sashc_test_plan.jmx \
                                  -l tests/results.jtl \
                                  -e -o tests/jmeter-report \
                                  -Jhost="${JMETER_HOST}" \
                                  -Jport="${JMETER_PORT}" \
                                  -Jemail="${JMETER_EMAIL}" \
                                  -Jpassword="${JMETER_PASS}" \
                                  -Jyear="${JMETER_YEAR}"
                            '''
                        }
                    }
                }
            }
            post {
                always {
                    // Always archive the raw results + HTML report so they're
                    // downloadable from the build even without extra plugins.
                    archiveArtifacts(
                        artifacts: 'tests/results.jtl, tests/jmeter-report/**',
                        allowEmptyArchive: true
                    )
                    // publishHTML requires the "HTML Publisher" plugin. If it's
                    // not installed, skip it instead of failing the build.
                    script {
                        try {
                            publishHTML(target: [
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'tests/jmeter-report',
                                reportFiles: 'index.html',
                                reportName: 'JMeter Performance Report'
                            ])
                        } catch (err) {
                            echo "publishHTML skipped - install the 'HTML Publisher' plugin to view the report inline. (${err})"
                        }
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Building Docker image (tagged latest + commit SHA)...'
                sh '''
                    docker build \
                      -t ${DOCKER_IMAGE}:latest \
                      -t ${DOCKER_IMAGE}:${GIT_SHA} .
                '''
            }
        }

        stage('Deploy') {
            steps {
                echo 'Pushing Docker image to Docker Hub...'
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${DOCKER_IMAGE}:latest
                        docker push ${DOCKER_IMAGE}:${GIT_SHA}
                        docker logout
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline completed.'
            // Updates Jira issues referenced in commit messages, e.g.
            // "SOFTCON-12 fix login bug" (Tasks A3 & A4).
            // Requires the Jira plugin + a configured Jira site in Jenkins.
            step([$class: 'hudson.plugins.jira.JiraIssueUpdater',
                  issueSelector: [$class: 'hudson.plugins.jira.selector.DefaultIssueSelector'],
                  scm: scm])
        }
        success {
            echo 'All stages passed successfully!'
        }
        failure {
            echo 'Pipeline failed. Check logs.'
        }
    }
}
