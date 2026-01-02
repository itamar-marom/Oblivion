# Testing Standards

**Purpose**: Comprehensive testing guidelines and philosophy for all components in the Oblivion monorepo.

## Testing Philosophy

Testing in Oblivion follows these core principles:

1. **Confidence Over Coverage**: Tests should give confidence that code works, not just hit coverage targets
2. **Test Behavior, Not Implementation**: Test what the code does, not how it does it
3. **Fast Feedback Loops**: Tests should run quickly to enable rapid iteration
4. **Maintainable Tests**: Tests should be easy to understand, update, and debug
5. **Realistic Testing**: Test in conditions as close to production as possible
6. **Test Early, Test Often**: Write tests as you write code, not after

### Testing Mindset

- ✅ **Write tests first** for critical business logic (TDD when appropriate)
- ✅ **Test the happy path** and error cases
- ✅ **Test edge cases** and boundary conditions
- ✅ **Test integration points** between components
- ❌ **Don't test implementation details** (private methods, internal state)
- ❌ **Don't test the framework** (FastAPI, Next.js, etc. are already tested)
- ❌ **Don't write tests that don't add value** (testing getters/setters)

## Testing Pyramid

Oblivion follows the testing pyramid principle:

```
         /\
        /  \    E2E Tests (Few)
       /____\   - Full system tests
      /      \  - Test user workflows
     /________\ - Slow, expensive
    /          \
   /            \ Integration Tests (Some)
  /______________\ - Test component interactions
 /                \ - Database, API, external services
/                  \ - Moderate speed
/____________________\
|    Unit Tests      | Unit Tests (Many)
|     (Many)         | - Test individual functions/methods
|____________________| - Fast, isolated, cheap

Ideal ratio: 70% Unit, 20% Integration, 10% E2E
```

### Test Types Breakdown

| Type | Purpose | Speed | Cost | Scope |
|------|---------|-------|------|-------|
| **Unit** | Test single function/class | Very Fast | Low | Narrow |
| **Integration** | Test component interaction | Medium | Medium | Medium |
| **E2E** | Test entire user flow | Slow | High | Wide |

## Test Types

### Unit Tests

**Purpose**: Test individual functions, methods, or classes in isolation.

**Characteristics**:
- ✅ Fast (milliseconds)
- ✅ No external dependencies (DB, API, filesystem)
- ✅ Use mocks/stubs for dependencies
- ✅ Test single responsibility
- ✅ High coverage (aim for 80%+)

**When to Write**:
- Business logic and algorithms
- Utility functions and helpers
- Data transformations
- Validation logic
- Pure functions (no side effects)

**Example Scenarios**:
- Password hashing/validation
- Date formatting utilities
- Calculation functions
- String manipulation
- Input sanitization

**Best Practices**:
```python
# ✅ Good: Tests single responsibility
def test_calculate_discount():
    result = calculate_discount(price=100, discount_percent=20)
    assert result == 80

# ✅ Good: Tests edge cases
def test_calculate_discount_zero():
    result = calculate_discount(price=100, discount_percent=0)
    assert result == 100

def test_calculate_discount_invalid():
    with pytest.raises(ValueError):
        calculate_discount(price=100, discount_percent=150)

# ❌ Bad: Tests implementation details
def test_discount_uses_multiplication():
    # Don't test HOW it calculates, test WHAT it returns
    pass
```

### Integration Tests

**Purpose**: Test how components work together (services, database, APIs).

**Characteristics**:
- ⚠️ Medium speed (seconds)
- ⚠️ May use real dependencies (test DB, real services)
- ⚠️ Tests component boundaries
- ⚠️ Setup and teardown required
- ✅ Moderate coverage (aim for 60%+)

**When to Write**:
- API endpoints (request → response)
- Database operations (CRUD)
- Service layer interactions
- Message queue handlers
- Cache interactions
- File system operations

**Example Scenarios**:
- Creating a user via API (includes validation, DB, response)
- Fetching data with joins/relations
- File upload and processing
- Authentication flow
- Payment processing

**Best Practices**:
```typescript
// ✅ Good: Tests full endpoint flow
test('POST /users creates user', async () => {
  const response = await request(app)
    .post('/users')
    .send({ email: 'test@example.com', password: 'Test123!' });

  expect(response.status).toBe(201);
  expect(response.body.email).toBe('test@example.com');

  // Verify in database
  const user = await db.users.findByEmail('test@example.com');
  expect(user).toBeDefined();
});

// ✅ Good: Uses test database
beforeEach(async () => {
  await db.migrate.latest();
  await db.seed.run();
});

afterEach(async () => {
  await db.migrate.rollback();
});

// ❌ Bad: Uses production database
// Never test against production!
```

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from frontend to backend.

**Characteristics**:
- 🐌 Slow (seconds to minutes)
- 💰 Expensive to maintain
- 🌍 Tests entire system
- 🔄 Flaky if not written carefully
- ✅ Low coverage (aim for critical paths only)

**When to Write**:
- Critical user journeys (signup, checkout, etc.)
- Complex multi-step workflows
- Cross-service interactions
- Authentication flows
- Payment flows

**Example Scenarios**:
- User signs up, verifies email, logs in
- User adds item to cart, checks out, receives confirmation
- Admin creates content, publishes, user views it
- User uploads file, processes, downloads result

**Best Practices**:
```typescript
// ✅ Good: Tests critical user flow
test('user can complete checkout', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Add to cart
  await page.goto('/products/1');
  await page.click('button:has-text("Add to Cart")');

  // Checkout
  await page.goto('/checkout');
  await page.fill('[name="card"]', '4242424242424242');
  await page.click('button:has-text("Complete Purchase")');

  // Verify success
  await expect(page.locator('text=Order confirmed')).toBeVisible();
});

// ✅ Good: Uses test data
beforeEach(async () => {
  await setupTestDatabase();
  await createTestUser('user@example.com');
});

// ❌ Bad: Testing every permutation
// Don't write E2E tests for edge cases - use unit/integration tests
```

## Test Organization

### Directory Structure

Each component manages its own tests:

```
services/api/                    # Backend service
├── app/
│   └── services/
│       └── user.py
└── tests/
    ├── unit/
    │   └── test_user_service.py    # Unit tests
    ├── integration/
    │   └── test_user_api.py        # Integration tests
    └── e2e/
        └── test_user_flow.py       # E2E tests

services/web/                    # Frontend service
├── app/
│   └── components/
│       └── Button.tsx
└── tests/
    ├── unit/
    │   └── Button.test.tsx         # Component tests
    ├── integration/
    │   └── UserForm.test.tsx       # Integration tests
    └── e2e/
        └── checkout.spec.ts        # E2E tests (Playwright)

packages/common/                 # Shared package
├── src/
│   └── utils.py
└── tests/
    └── test_utils.py               # Package tests
```

### Naming Conventions

#### Python (pytest)
- **Files**: `test_*.py` or `*_test.py`
- **Functions**: `test_*` (e.g., `test_create_user`)
- **Classes**: `Test*` (e.g., `TestUserService`)
- **Fixtures**: Descriptive names (e.g., `db_session`, `mock_api_client`)

```python
# tests/unit/test_user_service.py
class TestUserService:
    def test_create_user(self, db_session):
        """Test creating a new user."""
        pass

    def test_create_user_duplicate_email(self, db_session):
        """Test creating user with duplicate email raises error."""
        pass
```

#### Node.js/TypeScript (Vitest)
- **Files**: `*.test.ts` or `*.spec.ts`
- **Tests**: `describe()` and `test()` or `it()`
- **Groups**: Use `describe` for logical grouping

```typescript
// services/api/tests/unit/user.service.test.ts
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user', async () => {
      // test code
    });

    it('should throw error for duplicate email', async () => {
      // test code
    });
  });
});
```

#### Frontend (React Testing Library + Playwright)
- **Component Tests**: `*.test.tsx` (co-located with components)
- **E2E Tests**: `*.spec.ts` in `tests/e2e/`

```typescript
// app/components/Button.test.tsx
describe('Button', () => {
  it('renders children correctly', () => {
    // test code
  });

  it('calls onClick when clicked', () => {
    // test code
  });
});

// tests/e2e/login.spec.ts
test('user can log in', async ({ page }) => {
  // test code
});
```

### Test Data Management

#### Fixtures (Python - pytest)
```python
# tests/conftest.py
import pytest
from app.db.session import AsyncSessionLocal

@pytest.fixture
async def db_session():
    """Provide test database session."""
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture
def sample_user():
    """Provide sample user data."""
    return {
        "email": "test@example.com",
        "password": "Test123!",
        "name": "Test User",
    }

@pytest.fixture
async def created_user(db_session, sample_user):
    """Provide created user in database."""
    user = await user_service.create(db_session, sample_user)
    return user
```

#### Factories (Python - factory_boy)
```python
# tests/factories.py
import factory
from app.models import User

class UserFactory(factory.Factory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Faker("name")
    is_active = True

# Usage
user = UserFactory()
users = UserFactory.create_batch(10)
```

#### Fixtures (Node.js - Vitest)
```typescript
// tests/fixtures/user.ts
export const sampleUser = {
  email: 'test@example.com',
  password: 'Test123!',
  name: 'Test User',
};

export async function createTestUser(db: Database) {
  return db.users.create(sampleUser);
}
```

#### Test Data Guidelines
- ✅ Use factories for complex object creation
- ✅ Use fixtures for reusable test data
- ✅ Reset test data between tests
- ✅ Use realistic data (proper formats, valid values)
- ❌ Don't reuse data across tests (causes flakiness)
- ❌ Don't hardcode production data in tests

## Coverage Requirements

### Minimum Coverage Targets

- **Overall**: 80% code coverage
- **Critical Paths**: 95%+ coverage (auth, payments, data loss prevention)
- **New Code**: 90%+ coverage (enforce in PR checks)
- **Legacy Code**: Gradual improvement (don't block on legacy)

### Coverage by Component Type

| Component | Target | Priority |
|-----------|--------|----------|
| Business Logic | 90%+ | High |
| API Endpoints | 80%+ | High |
| Services Layer | 85%+ | High |
| Models/Schemas | 70%+ | Medium |
| Utilities | 90%+ | High |
| Config/Setup | 50%+ | Low |
| UI Components | 75%+ | Medium |

### Measuring Coverage

#### Python (pytest-cov)
```bash
# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term

# Coverage report location
open htmlcov/index.html
```

#### Node.js (Vitest)
```bash
# Run with coverage
vitest run --coverage

# Coverage report location
open coverage/index.html
```

#### Frontend (Jest/Vitest)
```bash
# Run with coverage
npm test -- --coverage

# Coverage report location
open coverage/lcov-report/index.html
```

### Coverage Best Practices

- ✅ Track coverage trends over time
- ✅ Fail CI if coverage drops below threshold
- ✅ Focus on untested critical paths
- ✅ Use coverage to find gaps, not as a goal
- ❌ Don't game coverage (meaningless assertions)
- ❌ Don't test for 100% coverage (diminishing returns)

## Mocking & Stubbing

### When to Mock

**Mock External Dependencies**:
- ✅ Third-party APIs (Stripe, SendGrid, etc.)
- ✅ External services (databases in unit tests)
- ✅ File system operations
- ✅ Network requests
- ✅ Time/Date (for consistent tests)

**Don't Mock**:
- ❌ Your own code (test integration instead)
- ❌ Simple functions (just call them)
- ❌ Database in integration tests (use test DB)

### Mocking Strategies

#### Python (unittest.mock)
```python
from unittest.mock import Mock, patch, AsyncMock

# Mock function
@patch('app.services.email.send_email')
def test_user_signup(mock_send_email):
    mock_send_email.return_value = True
    user = signup_user('test@example.com')
    mock_send_email.assert_called_once()

# Mock async function
@patch('app.services.api.fetch_data', new_callable=AsyncMock)
async def test_fetch_user_data(mock_fetch):
    mock_fetch.return_value = {"id": 1, "name": "Test"}
    result = await get_user_data(1)
    assert result["name"] == "Test"

# Mock class
mock_stripe = Mock()
mock_stripe.create_payment.return_value = {"id": "payment_123"}
```

#### Node.js (Vitest)
```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('./email', () => ({
  sendEmail: vi.fn(),
}));

// Mock function
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

mockFetch.mockResolvedValue({
  json: async () => ({ data: 'test' }),
});

// Spy on function
const spy = vi.spyOn(userService, 'createUser');
await userService.createUser(data);
expect(spy).toHaveBeenCalledWith(data);
```

#### Frontend (Jest)
```typescript
// Mock API call
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'test' }),
  })
);

// Mock component
jest.mock('../components/Header', () => ({
  Header: () => <div>Mocked Header</div>,
}));
```

## Running Tests

### Per-Stack Commands

#### Python Backend
```bash
# Navigate to service
cd services/api

# Run all tests
pytest

# Run specific file
pytest tests/unit/test_user_service.py

# Run specific test
pytest tests/unit/test_user_service.py::test_create_user

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run in parallel
pytest -n auto

# Run only failed tests
pytest --lf

# Watch mode (with pytest-watch)
ptw
```

#### Node.js Backend
```bash
# Navigate to service
cd services/api-node

# Run all tests
npm test

# Run specific file
npm test -- user.service.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Run in UI mode
npm test -- --ui
```

#### Frontend
```bash
# Navigate to service
cd services/web

# Run component tests
npm test

# Run E2E tests
npm run test:e2e

# Run E2E in UI mode
npm run test:e2e -- --ui

# Run specific E2E test
npm run test:e2e -- login.spec.ts
```

### Monorepo-Wide Testing

```bash
# From root directory

# Run all tests in all services
./scripts/test-all.sh

# Run Python tests only
./scripts/test-python.sh

# Run Node.js tests only
./scripts/test-node.sh

# Run frontend tests only
./scripts/test-frontend.sh

# Run tests for changed files only (CI optimization)
./scripts/test-changed.sh
```

## CI/CD Integration

### Test Execution Strategy

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test-python:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install uv
        run: pip install uv
      - name: Install dependencies
        run: uv sync
        working-directory: services/api
      - name: Run tests
        run: uv run pytest --cov=app --cov-report=xml
        working-directory: services/api
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: services/api/coverage.xml

  test-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
        working-directory: services/api-node
      - name: Run tests
        run: npm test -- --coverage
        working-directory: services/api-node

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install dependencies
        run: npm ci
        working-directory: services/web
      - name: Run unit tests
        run: npm test
        working-directory: services/web
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: services/web
```

### CI Best Practices

- ✅ Run tests on every push/PR
- ✅ Fail fast (stop on first failure)
- ✅ Run tests in parallel when possible
- ✅ Cache dependencies between runs
- ✅ Upload coverage reports
- ✅ Run E2E tests on staging environment
- ❌ Don't skip tests to speed up CI
- ❌ Don't ignore flaky tests (fix them)

## Test Quality Standards

### What Makes a Good Test?

1. **Fast**: Runs in milliseconds (unit) or seconds (integration)
2. **Isolated**: No dependencies on other tests
3. **Repeatable**: Same result every time
4. **Self-validating**: Pass/fail is clear (no manual checking)
5. **Timely**: Written with or before code

### Test Smells (Anti-patterns)

❌ **Slow Tests**: Unit tests that take seconds
❌ **Flaky Tests**: Tests that randomly fail
❌ **Coupled Tests**: Tests that depend on execution order
❌ **Unclear Tests**: Hard to understand what's being tested
❌ **Brittle Tests**: Break when implementation changes
❌ **Testing Implementation**: Tests that know too much about how code works
❌ **Too Many Mocks**: Mocking everything defeats the purpose
❌ **God Tests**: One test that tests everything
❌ **No Assertions**: Tests that don't verify anything
❌ **Ignored Tests**: Commented out or skipped tests

### Test Checklist

Before committing tests, verify:

- [ ] Tests have clear, descriptive names
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Tests are isolated and independent
- [ ] Tests clean up after themselves
- [ ] No hardcoded values (use constants/fixtures)
- [ ] Edge cases are covered
- [ ] Error cases are tested
- [ ] Tests run fast
- [ ] Tests are deterministic (no randomness, unless seeded)
- [ ] Mocks are used appropriately
- [ ] Test data is realistic
- [ ] All assertions have clear failure messages

## Testing Best Practices

### Arrange-Act-Assert (AAA) Pattern

```python
def test_create_user():
    # Arrange: Setup test data
    user_data = {
        "email": "test@example.com",
        "password": "Test123!",
    }

    # Act: Execute the operation
    user = create_user(user_data)

    # Assert: Verify the result
    assert user.email == user_data["email"]
    assert user.id is not None
```

### Given-When-Then (BDD Style)

```typescript
test('user can add item to cart', async () => {
  // Given: A logged-in user viewing a product
  await loginUser('user@example.com');
  await navigateTo('/products/123');

  // When: They click "Add to Cart"
  await clickButton('Add to Cart');

  // Then: The item appears in their cart
  const cart = await getCart();
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0].productId).toBe('123');
});
```

### Test One Thing

```python
# ✅ Good: Tests one behavior
def test_user_login_success():
    user = login("test@example.com", "password")
    assert user is not None

def test_user_login_invalid_password():
    with pytest.raises(AuthError):
        login("test@example.com", "wrong")

# ❌ Bad: Tests multiple behaviors
def test_user_login():
    # Tests too many things at once
    user = login("test@example.com", "password")
    assert user is not None

    with pytest.raises(AuthError):
        login("test@example.com", "wrong")

    with pytest.raises(AuthError):
        login("invalid@example.com", "password")
```

### Descriptive Test Names

```python
# ✅ Good: Clear what's being tested
def test_create_user_with_valid_email_succeeds()
def test_create_user_with_duplicate_email_raises_error()
def test_create_user_with_invalid_email_raises_validation_error()

# ❌ Bad: Unclear what's being tested
def test_create_user_1()
def test_create_user_2()
def test_user()
```

### Test Data Builders

```typescript
// Builder pattern for complex test data
class UserBuilder {
  private data: Partial<User> = {
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
  };

  withEmail(email: string) {
    this.data.email = email;
    return this;
  }

  withName(name: string) {
    this.data.name = name;
    return this;
  }

  inactive() {
    this.data.isActive = false;
    return this;
  }

  build(): User {
    return this.data as User;
  }
}

// Usage
const user = new UserBuilder()
  .withEmail('admin@example.com')
  .inactive()
  .build();
```

## Stack-Specific Testing Guides

For detailed, stack-specific testing patterns and examples, refer to:

- **[Python Backend Testing](./backend-python.md#testing-with-pytest)** - pytest, fixtures, async tests
- **[Node.js Backend Testing](./backend-node.md#testing-patterns)** - Vitest, mocking, integration tests
- **[Frontend Testing](./frontend.md#testing-frontend-components)** - React Testing Library, Playwright, component tests

## Performance Testing

### Load Testing

```python
# Using Locust for load testing
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def get_users(self):
        self.client.get("/api/v1/users")

    @task(3)  # 3x more frequent
    def create_user(self):
        self.client.post("/api/v1/users", json={
            "email": "test@example.com",
            "password": "Test123!",
        })

# Run: locust -f tests/performance/test_api.py
```

### Benchmarking

```python
# Using pytest-benchmark
def test_calculate_performance(benchmark):
    result = benchmark(calculate_expensive_operation, large_dataset)
    assert result is not None
```

## Continuous Improvement

### Test Metrics to Track

- **Coverage Trend**: Is coverage improving over time?
- **Test Duration**: Are tests getting slower?
- **Flaky Test Rate**: How many tests fail randomly?
- **Test-to-Code Ratio**: How many test lines per code line?
- **Failed Test Recovery Time**: How long to fix failing tests?

### Regular Test Maintenance

- **Weekly**: Review and fix flaky tests
- **Monthly**: Analyze slow tests and optimize
- **Quarterly**: Review test coverage gaps
- **Per PR**: Ensure new code has tests

---

*These testing standards evolve with the project. See [self-improvement.md](./self-improvement.md) for how to suggest improvements based on testing lessons learned.*

**Last Updated**: Initial version - 2026-01-02
