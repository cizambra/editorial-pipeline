import importlib

import app.services.generator_transport as gt


def test_select_model_override(monkeypatch):
    monkeypatch.setenv('MODEL_OVERRIDE', 'my-test-model')
    importlib.reload(gt)
    assert gt._select_model() == 'my-test-model'


def test_select_model_dryrun_default(monkeypatch):
    monkeypatch.delenv('MODEL_OVERRIDE', raising=False)
    monkeypatch.setenv('DRY_RUN', '1')
    monkeypatch.delenv('DRY_RUN_MODEL', raising=False)
    importlib.reload(gt)
    assert gt._select_model() == 'deepseek-chat'
