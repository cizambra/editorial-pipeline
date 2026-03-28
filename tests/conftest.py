import pytest

# project-wide fixtures go here; keep minimal for now
@pytest.fixture(autouse=True)
def ensure_clean_env(monkeypatch):
    # Clear DRY_RUN/MODEL_OVERRIDE by default to avoid cross-test leakage
    monkeypatch.delenv('DRY_RUN', raising=False)
    monkeypatch.delenv('MODEL_OVERRIDE', raising=False)
    monkeypatch.delenv('DRY_RUN_MODEL', raising=False)
    yield
