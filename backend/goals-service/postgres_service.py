"""PostgreSQL connection pooling for Lambda functions."""
from psycopg import connect, OperationalError

_PG_CONN = None


def get_db_connection(config: str):
    global _PG_CONN
    try:
        if _PG_CONN is None or _PG_CONN.closed:
            _PG_CONN = connect(config)
        return _PG_CONN
    except OperationalError as e:
        _PG_CONN = None
        raise e


def release_connection(conn):
    pass
