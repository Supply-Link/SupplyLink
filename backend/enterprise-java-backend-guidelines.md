# Enterprise Java Backend Engineering Guidelines & Guardrails

**Reference stack:** Java, Spring Boot, Maven, PostgreSQL\
**Purpose:** A practical engineering standard for building maintainable,
secure, testable, and production-ready backend services.

> These guidelines are defaults, not universal laws. Follow the
> conventions of the repository and engineering team when they differ.
> Prefer evidence and clear trade-offs over arbitrary rules.

------------------------------------------------------------------------

## 1. Core engineering principles

Optimize for:

1.  **Correctness:** business behavior must be accurate and predictable.
2.  **Maintainability:** another engineer should be able to understand
    and change the code safely.
3.  **Simplicity:** use the simplest design that meets current
    requirements.
4.  **Testability:** important behavior must be verifiable
    automatically.
5.  **Security:** enforce authentication, authorization, validation, and
    data protection at the server.
6.  **Reliability:** handle failures, retries, concurrency, and partial
    outages deliberately.
7.  **Consistency:** follow repository-wide conventions and avoid
    one-off patterns.

Apply these principles:

-   **Single Responsibility:** a class or method should have a cohesive
    purpose.
-   **DRY:** avoid duplicated knowledge and business rules; do not
    abstract merely to eliminate similar-looking lines.
-   **KISS:** avoid unnecessary abstraction and indirection.
-   **YAGNI:** do not build speculative functionality.
-   **Composition over inheritance:** prefer composing focused
    collaborators unless inheritance models a genuine subtype
    relationship.
-   **Explicit over implicit:** make dependencies, side effects, and
    important behavior visible.

------------------------------------------------------------------------

## 2. Recommended project structure

Prefer **package-by-feature** for most modular Spring Boot applications.
Keep related code together and make dependencies between features
intentional.

``` text
company-backend/
├── src/
│   ├── main/
│   │   ├── java/com/company/application/
│   │   │   ├── Application.java
│   │   │   ├── user/
│   │   │   │   ├── controller/
│   │   │   │   ├── service/
│   │   │   │   ├── repository/
│   │   │   │   ├── entity/
│   │   │   │   ├── dto/
│   │   │   │   └── mapper/
│   │   │   ├── order/
│   │   │   │   ├── controller/
│   │   │   │   ├── service/
│   │   │   │   ├── repository/
│   │   │   │   ├── entity/
│   │   │   │   ├── dto/
│   │   │   │   └── mapper/
│   │   │   ├── payment/
│   │   │   ├── common/
│   │   │   │   ├── exception/
│   │   │   │   ├── response/
│   │   │   │   ├── validation/
│   │   │   │   └── security/
│   │   │   ├── config/
│   │   │   └── infrastructure/
│   │   │       ├── messaging/
│   │   │       ├── email/
│   │   │       └── storage/
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   └── test/
│       └── java/com/company/application/
│           ├── user/
│           ├── order/
│           └── payment/
├── pom.xml
├── Dockerfile
├── .gitignore
└── README.md
```

### Structure guardrails

-   Put the main Spring Boot application class in a root package above
    the application packages.
-   Organize by business capability (`user`, `order`, `payment`) rather
    than creating enormous global `controller`, `service`, and
    `repository` packages.
-   Keep feature-specific DTOs, mappers, and exceptions close to the
    feature that owns them.
-   Keep `common` small. Only place genuinely cross-feature, stable
    concepts there.
-   Do not create a generic `utils`, `helpers`, or `common` dumping
    ground.
-   Do not let one feature reach into another feature's internal
    implementation unnecessarily. Expose a clear service or
    application-level contract.
-   Add architecture layers only when they solve a real complexity or
    dependency problem.

For complex domains, consider Clean Architecture or Hexagonal
Architecture:

-   **Domain:** business concepts and rules.
-   **Application:** use cases and orchestration.
-   **Infrastructure:** database, messaging, and external-system
    adapters.
-   **Presentation:** HTTP controllers and API contracts.

Do not add layers mechanically to a small CRUD application.

------------------------------------------------------------------------

## 3. Naming and formatting conventions

  Element                   Convention         Example
  ------------------------- ------------------ -----------------------------
  Package                   lowercase          `com.company.order`
  Class / record            PascalCase         `OrderService`
  Interface                 PascalCase         `PaymentGateway`
  Method                    lower camelCase    `calculateTotal()`
  Variable / field          lower camelCase    `customerEmail`
  Constant                  UPPER_SNAKE_CASE   `MAX_RETRY_COUNT`
  Enum type                 PascalCase         `OrderStatus`
  Enum value                UPPER_SNAKE_CASE   `PAYMENT_PENDING`
  Test class                class + `Test`     `OrderServiceTest`
  Database table / column   snake_case         `order_items`, `created_at`

### Naming guardrails

-   Use names that communicate intent and domain meaning.
-   Prefer `findCustomerById` over `getData`, and
    `calculateInvoiceTotal` over `process`.
-   Avoid vague names such as `data`, `temp`, `obj`, `manager`,
    `helper`, and `commonService` unless their meaning is genuinely
    clear in context.
-   Use domain vocabulary consistently across code, APIs, and database
    schemas.
-   Boolean names should read naturally: `isActive`, `hasPermission`,
    `canRetry`.
-   Avoid abbreviations unless they are widely understood in the
    project.
-   Follow one formatter and import-order convention across the
    repository.

Use the [Google Java Style
Guide](https://google.github.io/styleguide/javaguide.html) or the team's
established style guide consistently. Its 100-character line limit is a
style convention, not a Java language requirement.

------------------------------------------------------------------------

## 4. File size, class size, and method size

Java and Spring Boot do not define a universal maximum number of lines
per file or method. Treat size thresholds as review signals, not hard
rules.

Suggested starting heuristics:

  Component                Typical review target
  ---------------------- -----------------------
  Controller                       30--120 lines
  Service                          50--200 lines
  Repository interface             20--100 lines
  DTO / record                      10--60 lines
  Mapper                           20--150 lines
  Utility class                    20--100 lines

Suggested method review signals:

-   **1--25 lines:** often easy to understand, provided the method is
    cohesive.
-   **25--40 lines:** inspect branching and responsibility.
-   **40--60 lines:** consider extracting meaningful operations.
-   **Over 60 lines:** review carefully for multiple responsibilities or
    excessive complexity.

These are not acceptance criteria. A clear 70-line algorithm may be
better than many tiny methods with vague names.

### Split a class when

-   It has multiple unrelated reasons to change.
-   It owns unrelated business responsibilities.
-   It has many dependencies because it coordinates too many concerns.
-   Its public API is difficult to understand.
-   It is hard to test without setting up unrelated behavior.
-   Different parts have different lifecycles or ownership.

### Extract a method when

-   A block has a meaningful name and purpose.
-   The same business rule is duplicated.
-   A complex condition can be named and tested independently.
-   The main workflow becomes easier to read after extraction.

Do **not** create one class per method. Avoid excessive indirection and
classes that merely forward calls.

------------------------------------------------------------------------

## 5. Reuse and abstraction rules

Choose the narrowest scope that satisfies the real use cases.

### Scope 1: Private implementation detail

Use a `private` method when the logic belongs to one class and has no
independent responsibility.

``` java
private BigDecimal calculateTax(BigDecimal taxableAmount) {
    return taxableAmount.multiply(TAX_RATE);
}
```

### Scope 2: Feature-level behavior

Use a focused collaborator when multiple classes in one feature need the
behavior or it has a distinct responsibility.

``` text
order/
└── service/
    ├── OrderService.java
    └── OrderPricingService.java
```

### Scope 3: Cross-feature capability

Move behavior into a shared component only when multiple real consumers
need the same stable capability and the abstraction does not couple
unrelated domains.

Examples may include a clock abstraction, current-user provider,
standardized error model, or shared security component.

### Scope 4: Infrastructure adapter

Encapsulate external systems behind clear interfaces or adapters where
useful:

``` text
infrastructure/
├── email/
├── storage/
└── messaging/
```

### Reuse guardrails

-   Do not make methods `public` just in case another class might use
    them.
-   Do not move business rules into `common` merely because they look
    similar.
-   Do not create a generic framework before there are real use cases.
-   Prefer duplication over a misleading abstraction when two rules only
    look similar but have different business meanings.
-   When extracting shared behavior, define ownership, input/output
    contracts, error behavior, and tests.
-   Avoid static utility methods for behavior that needs dependencies,
    configuration, state, or substitution in tests.

------------------------------------------------------------------------

## 6. Layer responsibilities

Keep dependencies flowing in a deliberate direction.

### Controller / presentation layer

Responsible for:

-   HTTP routes, request binding, and response status codes.
-   Request DTO validation.
-   Calling application or service operations.
-   Translating application results into HTTP responses.

Must not:

-   Contain complex business workflows.
-   Execute database queries directly.
-   Implement payment, pricing, or authorization rules ad hoc.
-   Return persistence entities as public API contracts.

### Service / application layer

Responsible for:

-   Business use cases and workflow orchestration.
-   Calling repositories and external collaborators.
-   Enforcing business invariants.
-   Defining appropriate transaction boundaries.

Must not become a dumping ground for unrelated features. Move cohesive
domain behavior into domain objects or focused collaborators where that
improves the model.

### Repository / persistence layer

Responsible for:

-   Persistence operations and query execution.
-   Database-specific access.
-   Mapping persistence concerns where appropriate.

Must not own application workflows or unrelated business decisions.

### Domain layer

Where the domain is complex, keep core business rules independent of
HTTP, database, and framework details as far as practical.

------------------------------------------------------------------------

## 7. DTOs, entities, and mapping

Do not expose JPA entities directly from public REST endpoints.

Use separate request and response contracts:

``` java
public record CreateUserRequest(
    @NotBlank String name,
    @Email String email,
    @NotBlank String password
) {}
```

``` java
public record UserResponse(
    Long id,
    String name,
    String email
) {}
```

### Guardrails

-   Keep request DTOs, response DTOs, and persistence entities
    conceptually separate.
-   Never expose password hashes, internal flags, or sensitive
    persistence fields accidentally.
-   Validate untrusted input at the application boundary.
-   Enforce business rules in the service/domain layer; DTO validation
    alone is not enough.
-   Use explicit mapping or a mapper library such as MapStruct when
    mapping becomes repetitive.
-   Avoid one giant DTO for create, update, and response operations.
-   Be deliberate about nullability and partial-update semantics.
-   Do not assume hiding a field in a response is a substitute for
    authorization.

------------------------------------------------------------------------

## 8. Dependency injection and Spring conventions

Prefer constructor injection.

``` java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;
}
```

Guardrails:

-   Prefer constructor injection over field injection.
-   Make required dependencies `final` where possible.
-   Avoid manually constructing Spring-managed services with `new`.
-   Avoid circular dependencies; fix the responsibility or dependency
    design.
-   Do not add an interface for every class automatically. Use
    interfaces when they provide a meaningful contract, substitution
    point, or architectural boundary.
-   Keep configuration explicit and environment-specific values outside
    source code.

------------------------------------------------------------------------

## 9. Exceptions and API error responses

Use exceptions that communicate meaningful failure conditions.

``` java
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(Long orderId) {
        super("Order not found: " + orderId);
    }
}
```

Handle expected application errors centrally using
`@RestControllerAdvice`.

### Guardrails

-   Do not catch `Exception` broadly unless the boundary genuinely needs
    to handle unknown failures.
-   Do not swallow exceptions or return success after a failed
    operation.
-   Do not use `System.out.println` for errors.
-   Do not expose stack traces, SQL details, secrets, or internal
    implementation information to clients.
-   Use appropriate HTTP status codes.
-   Return a consistent structured error format, for example:

``` json
{
  "timestamp": "2026-11-06T10:30:00Z",
  "status": 404,
  "code": "ORDER_NOT_FOUND",
  "message": "Order not found",
  "path": "/api/orders/123"
}
```

-   Preserve the original cause when wrapping an exception.
-   Log an exception at the layer that has enough context to make the
    log useful; avoid logging the same stack trace repeatedly at every
    layer.
-   Distinguish validation, business, authentication, authorization,
    infrastructure, and unexpected failures.

------------------------------------------------------------------------

## 10. Logging and observability

Use SLF4J with the logging implementation configured by Spring Boot. Do
not use `System.out.println` in application code.

``` java
log.info("Order created. orderId={}", orderId);
log.warn("Payment retry scheduled. orderId={}", orderId);
log.error("Payment processing failed. orderId={}", orderId, exception);
```

### Log levels

  Level   Appropriate use
  ------- -----------------------------------------------------------
  TRACE   Very detailed diagnostics, usually disabled in production
  DEBUG   Developer diagnostics
  INFO    Significant normal application events
  WARN    Unexpected but recoverable conditions
  ERROR   Failed operations requiring attention

### Logging guardrails

-   Use parameterized logging (`{}`), not string concatenation.
-   Include useful identifiers such as request, order, or correlation
    IDs.
-   Never log passwords, access tokens, API keys, payment data, or
    sensitive personal information.
-   Avoid logging entire request bodies by default.
-   Avoid noisy logs inside tight loops or high-volume paths.
-   Include exception objects when a stack trace is needed.
-   Prefer structured logs in distributed systems.
-   Use correlation IDs and distributed tracing to follow requests
    across services.
-   Add metrics and health checks for operationally important behavior.

Consider [OpenTelemetry](https://opentelemetry.io/) for traces, metrics,
and logs.

------------------------------------------------------------------------

## 11. Database and transaction practices

Use schema migrations (for example, Flyway or Liquibase) to version
database changes.

### Guardrails

-   Use parameterized queries; never concatenate untrusted input into
    SQL.
-   Add indexes based on actual query patterns and measured performance.
-   Avoid loading unbounded result sets; paginate or stream
    appropriately.
-   Watch for N+1 queries and accidental eager loading.
-   Select only the data required by the use case where practical.
-   Use connection pooling and configure pool limits deliberately.
-   Set sensible query and transaction timeouts.
-   Keep transactions as short as practical.
-   Understand transaction isolation, rollback behavior, and
    propagation.
-   Use optimistic or pessimistic locking based on contention and
    correctness requirements.
-   Handle deadlocks and transient failures deliberately.
-   Do not assume `@Transactional` works across every self-invocation or
    execution boundary; understand Spring proxy semantics.
-   Do not perform slow external network calls inside a database
    transaction unless the design explicitly requires it.
-   Use database constraints for critical invariants in addition to
    application validation.

### Transaction example

``` java
@Transactional
public void transfer(Long sourceId, Long destinationId, BigDecimal amount) {
    Account source = accountRepository.findById(sourceId)
        .orElseThrow(() -> new AccountNotFoundException(sourceId));

    Account destination = accountRepository.findById(destinationId)
        .orElseThrow(() -> new AccountNotFoundException(destinationId));

    source.debit(amount);
    destination.credit(amount);
}
```

The operation should be atomic within the configured transaction manager
and database. Concurrency controls and domain validation are still
required.

------------------------------------------------------------------------

## 12. Security guardrails

Security is a design requirement, not a final checklist item.

-   Use Spring Security for authentication and authorization.
-   Enforce authorization on the server for every protected operation
    and resource.
-   Do not assume an authenticated user may access another user's
    resource.
-   Hash passwords using an appropriate password-hashing algorithm such
    as BCrypt or Argon2; never store plaintext passwords.
-   Use OAuth 2.0 / OpenID Connect when appropriate for delegated
    authentication and authorization.
-   Validate JWT signature, issuer, audience, expiry, and required
    claims.
-   Store secrets in a secret manager or secure deployment
    configuration, not in Git.
-   Use HTTPS/TLS in deployed environments.
-   Validate and normalize untrusted input.
-   Apply least privilege to application and database accounts.
-   Protect against injection, insecure direct object references, mass
    assignment, and excessive data exposure.
-   Apply rate limits and abuse protections to sensitive endpoints.
-   Avoid leaking internal exception details to clients.
-   Keep dependencies patched and scan for known vulnerabilities.

Authentication answers **who is making the request?** Authorization
answers **what is that principal allowed to do?** They are separate
checks.

------------------------------------------------------------------------

## 13. Configuration and environment management

Keep environment-specific configuration outside source code.

Example `application.yml`:

``` yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}

server:
  port: ${SERVER_PORT:8080}
```

Use profiles only where they provide a clear configuration boundary,
such as local, test, staging, and production.

Guardrails:

-   Never commit credentials, tokens, private keys, or production
    secrets.
-   Do not hardcode environment-specific URLs or ports.
-   Validate required configuration at startup.
-   Keep defaults safe for local development.
-   Do not put secrets in logs or error responses.
-   Document required environment variables and configuration.

------------------------------------------------------------------------

## 14. Testing standards

Use a balanced test strategy. The exact test mix depends on the
application.

### Unit tests

Test focused business behavior without starting the entire application.
Use JUnit 5 and Mockito where appropriate.

### Integration tests

Verify interactions between components such as Spring configuration,
persistence, messaging, and external adapters. Testcontainers can
provide realistic disposable dependencies.

### API / end-to-end tests

Verify important workflows through application boundaries, including
authentication, authorization, validation, and error behavior.

### Testing guardrails

-   Test business rules, edge cases, failure paths, and authorization
    boundaries.
-   Test both successful and unsuccessful outcomes.
-   Avoid tests that merely repeat implementation details.
-   Keep tests deterministic; avoid dependence on real external
    services.
-   Use realistic test data and isolate test state.
-   Prefer Testcontainers over assumptions about a developer's local
    database.
-   Do not chase 100% coverage at the expense of meaningful assertions.
-   Ensure tests run in CI, not only on a developer's machine.

Useful tools:

-   JUnit 5
-   Mockito
-   Spring Boot Test
-   Testcontainers
-   REST Assured

------------------------------------------------------------------------

## 15. API design

-   Use resource-oriented, consistent endpoint naming.
-   Use HTTP methods and status codes according to their semantics.
-   Validate request payloads and return actionable validation errors.
-   Use pagination, filtering, and sorting for potentially large
    collections.
-   Define a consistent error response contract.
-   Document APIs with OpenAPI where appropriate.
-   Plan compatibility before changing public request or response
    contracts.
-   Version APIs only when there is a real compatibility or lifecycle
    need.
-   Avoid leaking internal entity structure into API contracts.
-   Define timeout, retry, and idempotency behavior for operations that
    may be retried.

For non-idempotent operations such as payment creation, consider an
idempotency key and persist the result associated with that key.

------------------------------------------------------------------------

## 16. External integrations and distributed systems

Treat databases, message brokers, payment gateways, email providers, and
other services as unreliable dependencies.

-   Define explicit timeouts for outbound calls.
-   Retry only failures that are safe to retry.
-   Use bounded retries with exponential backoff and jitter.
-   Avoid retry storms and unbounded retry loops.
-   Use circuit breakers where repeated dependency failures could
    exhaust resources.
-   Make message consumers idempotent.
-   Define dead-letter handling and replay procedures.
-   Understand at-least-once delivery and duplicate messages.
-   Use the transactional outbox pattern when database updates and event
    publication must be coordinated reliably.
-   Do not assume a distributed transaction exists across independent
    services.
-   Monitor latency, error rates, queue depth, and dependency health.

------------------------------------------------------------------------

## 17. Code review and pull request standards

Before opening a pull request, verify:

-   The change solves the stated requirement and avoids unrelated scope.
-   Names and package placement are consistent with the codebase.
-   Responsibilities and dependencies are clear.
-   No unnecessary abstraction or duplicated business rule was
    introduced.
-   Validation, authorization, and error paths are covered.
-   Database changes include migrations and appropriate constraints.
-   Transactions and concurrency behavior have been considered.
-   Logs are useful and contain no sensitive data.
-   Tests cover important behavior and pass locally.
-   Static analysis and formatting checks pass.
-   Configuration and documentation are updated where needed.
-   The PR description explains intent, important design decisions, test
    evidence, and operational impact.

Keep pull requests focused and reviewable. Split unrelated changes.

------------------------------------------------------------------------

## 18. Static analysis, formatting, and CI

Automate standards wherever practical so that code quality does not
depend on memory.

Useful tools:

  Tool                       Purpose
  -------------------------- -----------------------------------------------------
  Checkstyle                 Java style and formatting rules
  SpotBugs                   Potential defects in bytecode
  SonarQube                  Static analysis, code smells, and quality reporting
  JUnit                      Automated tests
  Testcontainers             Integration tests with real dependencies
  Maven                      Build and dependency management
  GitHub Actions / Jenkins   CI pipelines

A typical CI pipeline:

``` text
Commit / Pull Request
        |
        v
Compile
        |
        v
Format and style checks
        |
        v
Unit tests
        |
        v
Integration tests
        |
        v
Static analysis and security scans
        |
        v
Package application
        |
        v
Build container image
        |
        v
Deploy through approved environments
```

Configure quality gates to fail builds for agreed critical issues. Tune
rules to the team's stack and risk profile rather than blindly enabling
every possible rule.

------------------------------------------------------------------------

## 19. Production readiness checklist

Before releasing a service, verify:

-   [ ] Configuration is externalized and validated.
-   [ ] Secrets are stored securely.
-   [ ] Authentication and authorization are tested.
-   [ ] Input validation and error handling are consistent.
-   [ ] Database migrations are reviewed and repeatable.
-   [ ] Transactions and concurrency behavior are understood.
-   [ ] Timeouts and retry policies are bounded.
-   [ ] Logs, metrics, traces, and health checks are available.
-   [ ] Sensitive information is not logged.
-   [ ] Critical business paths have automated tests.
-   [ ] Database queries and indexes have been reviewed.
-   [ ] Resource limits and connection pools are configured.
-   [ ] Deployment and rollback procedures are documented.
-   [ ] Backup and recovery expectations are understood.
-   [ ] Alerts exist for important failure modes.

------------------------------------------------------------------------

## 20. Practical rules to remember

1.  Prefer readable code over clever code.
2.  Keep classes cohesive; do not enforce arbitrary line-count limits.
3.  Extract meaningful operations, not trivial one-line wrappers.
4.  Reuse stable behavior only when real use cases justify it.
5.  Keep business rules out of controllers and repositories.
6.  Keep API DTOs separate from persistence entities.
7.  Prefer constructor injection.
8.  Handle errors centrally without hiding failures.
9.  Log useful context, never secrets.
10. Make database changes through migrations.
11. Keep transactions short and understand their boundaries.
12. Test business behavior and failure cases.
13. Enforce authorization on every protected resource.
14. Configure timeouts and safe retry behavior.
15. Automate formatting, testing, and static analysis.
16. Follow the repository's established conventions unless there is a
    documented reason to change them.

------------------------------------------------------------------------

## 21. Recommended learning and reference material

-   [Google Java Style
    Guide](https://google.github.io/styleguide/javaguide.html)
-   [Spring Boot --- Structuring Your
    Code](https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html)
-   [Spring Framework --- Dependency
    Injection](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html)
-   [Spring Security
    Reference](https://docs.spring.io/spring-security/reference/)
-   [JUnit 5 User
    Guide](https://junit.org/junit5/docs/current/user-guide/)
-   [Testcontainers for Java](https://java.testcontainers.org/)
-   [Flyway Documentation](https://documentation.red-gate.com/flyway)
-   [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
-   [The Twelve-Factor App](https://12factor.net/)

------------------------------------------------------------------------

## Final engineering standard

For every class, method, abstraction, and dependency, be able to answer:

1.  What responsibility does it own?
2.  Why does it belong here?
3.  Who depends on it?
4.  What are its inputs, outputs, and failure modes?
5.  How is its behavior tested?
6.  What happens under concurrency or partial failure?
7.  Does it expose sensitive data or create an authorization risk?
8.  Is this the simplest design that meets the actual requirement?

If those questions have clear answers, the code is more likely to remain
understandable and safe as the system and team grow.
