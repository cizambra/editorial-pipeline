from __future__ import annotations

import unittest
from unittest import mock

from sqlalchemy.exc import IntegrityError

from app.persistence import db_runtime


class _BeginContext:
    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        return self._conn

    def __exit__(self, exc_type, exc, tb):
        return False


class RecordImageCostTests(unittest.TestCase):
    def test_record_image_cost_resets_postgres_sequence_and_retries_once(self) -> None:
        duplicate_error = IntegrityError(
            "INSERT INTO image_costs ...",
            {},
            Exception('duplicate key value violates unique constraint "image_costs_pkey"'),
        )
        conn = mock.Mock()
        conn.execute.side_effect = [duplicate_error, None]

        engine = mock.Mock()
        engine.dialect.name = "postgresql"
        engine.begin.side_effect = [_BeginContext(conn), _BeginContext(conn)]

        with mock.patch.object(db_runtime, "ensure_schema"), mock.patch.object(
            db_runtime, "get_engine", return_value=engine
        ), mock.patch.object(db_runtime, "reset_identity_sequence") as reset_sequence:
            db_runtime.record_image_cost("concept_medium", 3, 0.189)

        self.assertEqual(conn.execute.call_count, 2)
        reset_sequence.assert_called_once_with(db_runtime.image_costs)

    def test_record_image_cost_does_not_swallow_other_integrity_errors(self) -> None:
        integrity_error = IntegrityError(
            "INSERT INTO image_costs ...",
            {},
            Exception("some other integrity error"),
        )
        conn = mock.Mock()
        conn.execute.side_effect = integrity_error

        engine = mock.Mock()
        engine.dialect.name = "postgresql"
        engine.begin.return_value = _BeginContext(conn)

        with mock.patch.object(db_runtime, "ensure_schema"), mock.patch.object(
            db_runtime, "get_engine", return_value=engine
        ), mock.patch.object(db_runtime, "reset_identity_sequence") as reset_sequence:
            with self.assertRaises(IntegrityError):
                db_runtime.record_image_cost("concept_medium", 3, 0.189)

        reset_sequence.assert_not_called()


if __name__ == "__main__":
    unittest.main()
