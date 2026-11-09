import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.utils.security import get_password_hash, create_access_token

# Test SQLite in-memory / file database
TEST_DATABASE_URL = "sqlite:///./test_gtmflow.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables in test database once for the session and clean up after."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional database session per test with automatic rollback."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient configured with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_admin_user(db_session: Session) -> User:
    """Create a persistent administrator user fixture."""
    admin = User(
        full_name="Admin Secfix",
        email="admin@secfix.example",
        password_hash=get_password_hash("AdminPassword123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def test_sales_user(db_session: Session) -> User:
    """Create a persistent sales representative user fixture."""
    sales = User(
        full_name="Sales Rep User",
        email="sales@secfix.example",
        password_hash=get_password_hash("SalesPassword123!"),
        role=UserRole.SALES,
        is_active=True,
    )
    db_session.add(sales)
    db_session.commit()
    db_session.refresh(sales)
    return sales


@pytest.fixture
def admin_token(test_admin_user: User) -> str:
    """Generate JWT access token for admin user."""
    return create_access_token(
        subject=test_admin_user.email,
        role=test_admin_user.role.value,
        user_id=str(test_admin_user.id),
    )


@pytest.fixture
def sales_token(test_sales_user: User) -> str:
    """Generate JWT access token for sales user."""
    return create_access_token(
        subject=test_sales_user.email,
        role=test_sales_user.role.value,
        user_id=str(test_sales_user.id),
    )
