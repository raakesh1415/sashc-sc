import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sashc.settings')
django.setup()

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from sashcapp.models import Headcount, Subject

print("=" * 55)
print("  SASHC — Random Forest Regression Model Evaluation")
print("=" * 55)

past_subjects = Subject.objects.filter(year__isnull=False)
records = Headcount.objects.filter(subjectID__in=past_subjects).values(
    'TOVmark', 'TOVgrade', 'ETRmark', 'ETRgrade', 'OTI1mark'
)

oti1_rows = []
for r in records:
    tov = float(r['TOVmark']) if r['TOVmark'] is not None else (0.0 if r['TOVgrade'] == 'TH' else None)
    etr = float(r['ETRmark']) if r['ETRmark'] is not None else (0.0 if r['ETRgrade'] == 'TH' else None)
    o1  = r['OTI1mark']
    if tov is not None and etr is not None and o1 is not None:
        oti1_rows.append([tov, etr, float(o1)])

arr = np.array(oti1_rows)
X, y = arr[:, :2], arr[:, 2]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

print()
print("  Dataset")
print(f"  {'Total records':<25}: {len(oti1_rows)}")
print(f"  {'Train size (80%)':<25}: {len(X_train)}")
print(f"  {'Test size  (20%)':<25}: {len(X_test)}")
print()
print("  Model Configuration")
print(f"  {'Algorithm':<25}: RandomForestRegressor")
print(f"  {'n_estimators':<25}: 100")
print(f"  {'random_state':<25}: 42")
print()
print("  Evaluation Results (Test Set)")
print(f"  {'R² Score':<25}: {r2:.4f}")
print(f"  {'Mean Absolute Error':<25}: {mae:.4f}")
print()
print("=" * 55)