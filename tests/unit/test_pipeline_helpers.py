import importlib
from datetime import datetime

import app.services.pipeline as pipeline


def test_save_checkpoint_respects_dry_run(monkeypatch):
    monkeypatch.setenv('DRY_RUN', '1')
    importlib.reload(pipeline)

    def bad_save(data):
        raise AssertionError('Should not call save in dry-run')

    # Patch underlying storage to ensure it would raise if called
    monkeypatch.setattr('app.persistence.storage.save_checkpoint', bad_save)
    # Should not raise
    pipeline._save_checkpoint({'data': {'a': 1}})


def test_reserve_and_persist(monkeypatch):
    # Non-dry-run path
    monkeypatch.delenv('DRY_RUN', raising=False)
    importlib.reload(pipeline)

    created = {'pending_id': None, 'saved': None}

    def fake_create_pending(title, url):
        created['pending_id'] = 42
        return 42

    def fake_save_run(title, url, data, token_summary, pending_run_id=None):
        created['saved'] = True
        return 99

    monkeypatch.setattr('app.persistence.storage.create_pending_run', fake_create_pending)
    monkeypatch.setattr('app.persistence.storage.save_run', fake_save_run)
    pid = pipeline._reserve_pending_run('t', 'u')
    assert pid == 42

    run_id = pipeline._persist_completed_run('t', 'u', {'quotes': []}, {}, pid)
    assert run_id == 99

    # Dry-run path: should not call storage
    monkeypatch.setenv('DRY_RUN', '1')
    importlib.reload(pipeline)

    def fail_create(*a, **k):
        raise AssertionError('create_pending_run should not be called')

    monkeypatch.setattr('app.persistence.storage.create_pending_run', fail_create)
    pid = pipeline._reserve_pending_run('t2', 'u2')
    assert pid is None

    def fail_save(*a, **k):
        raise AssertionError('save_run should not be called')

    monkeypatch.setattr('app.persistence.storage.save_run', fail_save)
    run_id = pipeline._persist_completed_run('t2', 'u2', {'quotes': []}, {}, None)
    assert run_id is None


def test_build_queue_results_marks_dry_run(monkeypatch):
    monkeypatch.setenv('DRY_RUN', '1')
    importlib.reload(pipeline)
    final_result = {
        'reflection': {'repurposed_en': {'linkedin': 'x'}, 'repurposed_es': {}},
        'companion': {'repurposed_en': {}, 'repurposed_es': {}},
    }
    reflection_date = datetime.now()
    companion_date = datetime.now()
    results = pipeline._build_queue_results(final_result, reflection_date, companion_date)
    # linkedin_en should be present and marked dry_run True
    assert results['reflection']['linkedin_en']['dry_run'] is True
    assert results['reflection']['linkedin_en']['queued'] is False
