# Bun Testing Guide

> **🔥 The definitive guide to testing with Bun**  
> *Because scattered documentation is the enemy of productive development*

## Table of Contents

1. [Test Configuration](#test-configuration)
2. [Code Coverage](#code-coverage)  
3. [Test File Discovery](#test-file-discovery)
4. [DOM Testing with Happy-DOM](#dom-testing-with-happy-dom)
5. [Watch Mode](#watch-mode)
6. [Test Lifecycle Hooks](#test-lifecycle-hooks)
7. [Mocking System](#mocking-system)
8. [Test Reporters](#test-reporters)
9. [Runtime Behavior](#runtime-behavior)
10. [Snapshot Testing](#snapshot-testing)
11. [Time Manipulation](#time-manipulation)
12. [Writing Tests](#writing-tests)

---

# Test Configuration

## Overview
Configure `bun test` behavior via `bunfig.toml` file and command-line options.

## Key Configuration Options

### Test Discovery
- **Root Directory**: `root = "src"` limits test scanning to specific directory
- Overrides default project-wide scanning for performance

### Memory Management
- **Smol Mode**: `smol = true` reduces memory usage during test runs
- Essential for CI environments with memory constraints

### Coverage Configuration
- **Test File Exclusion**: `coverageSkipTestFiles = true` excludes test files from reports
- **Thresholds**: Numeric (`0.9`) or object (`{ lines = 0.9, functions = 0.8 }`) syntax
- **Sourcemap Control**: `coverageIgnoreSourcemaps = true` for debugging transpilation

### Reporter Integration
- **JUnit XML**: `[test.reporter] junit = "path/to/junit.xml"` for CI/CD pipelines
- **Network Settings**: Inherits `[install]` configuration for private registries

---

# Code Coverage

## Overview
Built-in code coverage reporting with console output, threshold enforcement, and CI integration.

## Core Features
- **Console Reporting**: `--coverage` flag shows file-by-file breakdown with uncovered lines
- **Always-On**: `coverage = true` in bunfig.toml enables by default
- **Threshold Enforcement**: Automatic test failure when coverage falls below requirements

## Coverage Thresholds
- **Simple**: `coverageThreshold = 0.9` (90% for all metrics)
- **Granular**: `{ lines = 0.9, functions = 0.9, statements = 0.9 }`
- **Quality Gates**: Enables `fail_on_low_coverage` behavior

## Output Formats
- **Text Reporter**: Default console output with summary tables  
- **LCOV Reporter**: `coverageReporter = "lcov"` generates `lcov.info` for CI tools
- **Multi-Reporter**: `["text", "lcov"]` for comprehensive reporting
- **Custom Directory**: `coverageDir = "path/to/coverage"`

## File Handling
- **Test File Exclusion**: `coverageSkipTestFiles = true` excludes *.test.ts patterns
- **Default Exclusions**: node_modules, non-JS/TS files
- **Sourcemap Integration**: Automatic transpilation mapping (optional disable)

---

# Test File Discovery

## Overview
Automatic test file discovery with pattern matching, filtering, and execution control.

## Discovery Patterns
- **Test Files**: `*.test.{js|jsx|ts|tsx}`, `*_test.{js|jsx|ts|tsx}`
- **Spec Files**: `*.spec.{js|jsx|ts|tsx}`, `*_spec.{js|jsx|ts|tsx}`
- **Recursive Scanning**: Searches entire project directory tree

## Filtering Options
- **Path Filtering**: `bun test utils` runs tests with "utils" in path (substring match)
- **Exact Files**: `bun test ./test/specific.test.ts` for precise execution
- **Test Name Pattern**: `--test-name-pattern addition` uses regex against test names
- **Hierarchical Matching**: Matches "describe block + test name" concatenation

## Execution Behavior
- **Sequential Files**: Test files execute one at a time (not parallel)
- **Definition Order**: Tests within files run in declaration sequence
- **Root Override**: `root = "src"` in bunfig.toml limits scanning scope

## Exclusions
- **Node Modules**: Automatically ignored
- **Hidden Directories**: Skips dot-prefixed directories
- **File Types**: Only JavaScript-like extensions processed

---

# DOM Testing with Happy-DOM

## Overview
Headless browser environment simulation for frontend testing without browser overhead.

## Setup Process
1. **Install**: `bun add -d @happy-dom/global-registrator`
2. **Create Preload**: `GlobalRegistrator.register()` in `happydom.ts`
3. **Configure**: `preload = "./happydom.ts"` in bunfig.toml

## Browser API Availability
- **Global APIs**: `document`, `window`, DOM manipulation available without imports
- **TypeScript Support**: `/// <reference lib="dom" />` for type definitions
- **High Fidelity**: Complete HTML/DOM implementation in pure JavaScript

## Testing Capabilities
- **Element Manipulation**: Create, query, modify DOM elements
- **Event Simulation**: Trigger and handle browser events  
- **CSS Testing**: Style computation and layout validation
- **Form Interaction**: Input validation and submission testing

## Benefits
- **No Browser Required**: Eliminates Puppeteer/Playwright complexity
- **Fast Execution**: Pure JavaScript with minimal performance impact
- **CI Friendly**: No browser installation or management required
- **Framework Agnostic**: Works with any frontend framework or vanilla JS

---

# Watch Mode

## Overview
Ultra-fast file watching with automatic test re-execution on changes.

## Usage
- **Command**: `bun test --watch`
- **File Monitoring**: Tracks all files imported by test files
- **Smart Re-runs**: Only affected tests execute, not entire suite

## Performance
- **Speed**: Extremely fast change detection and execution
- **Efficiency**: Sub-second response times even in large codebases
- **Development Flow**: Near-instantaneous feedback during coding

## Use Cases
- **Test-Driven Development**: Real-time validation of code changes
- **Debugging**: Quick iteration when fixing failing tests
- **Refactoring**: Immediate feedback on code modifications
- **Learning**: Experimentation with instant results

---

# Test Lifecycle Hooks

## Overview
Jest-compatible lifecycle management for test setup, teardown, and scoping.

## Available Hooks
- **beforeAll**: Executes once before all tests in scope
- **beforeEach**: Runs before every individual test
- **afterEach**: Runs after every individual test
- **afterAll**: Executes once after all tests in scope

## Scoping Levels
- **Test-Level**: `beforeEach`/`afterEach` for per-test setup/cleanup
- **Suite-Level**: Hooks within `describe` blocks for grouped tests
- **File-Level**: Global hooks at file root for module-wide setup
- **Multi-File**: Preload files (`--preload ./setup.ts`) for global configuration

## Common Patterns
```typescript
// Per-test cleanup
beforeEach(() => resetMocks());
afterEach(() => cleanupDatabase());

// Suite-specific setup  
describe("database tests", () => {
  beforeAll(() => initializeTestDB());
  afterAll(() => teardownTestDB());
});
```

## Best Practices
- **Resource Management**: Always pair creation with cleanup
- **Test Isolation**: Prevent tests from affecting each other
- **Async Support**: All hooks support async/await operations
- **Error Handling**: Failed hooks fail entire scope

---

# Mocking System

## Overview
Comprehensive mocking with Jest compatibility, module mocking, spies, and Vitest support.

## Function Mocking
- **Creation**: `mock(() => Math.random())` or `jest.fn()` for decorated functions
- **Call Tracking**: `mockFn.mock.calls`, `mockFn.mock.results`, `mockFn.mock.lastCall`
- **Implementation Control**: `mockImplementation()`, `mockReturnValue()`, `mockResolvedValue()`
- **State Management**: `mockClear()`, `mockReset()`, `mockRestore()`

## Spy Functions
- **Non-Intrusive**: `spyOn(object, 'method')` monitors without replacement
- **Call Verification**: Compatible with `toHaveBeenCalled()` matchers
- **Original Preservation**: Method functionality maintained

## Module Mocking
- **Full Override**: `mock.module('./module', () => ({ foo: 'bar' }))`
- **ESM/CJS Support**: Works with both import and require
- **Live Bindings**: ESM imports update when mocks change
- **Lazy Evaluation**: Mock factory only runs when module imported

## Advanced Features
- **Import Timing**: Use `--preload` to mock before imports for side effect prevention
- **Global Management**: `mock.clearAllMocks()`, `mock.restore()` for batch operations
- **Vitest Compatibility**: `vi.fn`, `vi.spyOn`, `vi.mock` aliases for migration support
- **Path Resolution**: Automatic resolution of relative/absolute/package paths

---

# Test Reporters

## Overview
Flexible reporting with console output, JUnit XML, GitHub Actions integration, and custom reporters.

## Built-in Reporters
- **Console (Default)**: Human-readable with timing, colors, and terminal adaptation
- **JUnit XML**: `--reporter=junit --reporter-outfile=./junit.xml` for CI/CD
- **GitHub Actions**: Automatic detection with native annotations

## JUnit Reporter Features
- **CI Integration**: Compatible with GitLab, Jenkins, and other platforms
- **Environment Metadata**: Automatic CI variables (GITHUB_RUN_ID, commit SHA, hostname)
- **Configuration**: CLI flags or `[test.reporter] junit = "path"` in bunfig.toml

## Custom Reporter Architecture
- **Inspector Protocol**: WebKit Inspector Protocol extension for test events
- **Real-Time Monitoring**: Live test discovery, execution, completion tracking
- **Event Types**: `TestReporter.found/start/end`, `Console.messageAdded`, `LifecycleReporter.error`

## Multi-Reporter Support
- **Simultaneous Output**: Console + JUnit + custom reporters
- **Flexible Configuration**: Environment-based reporter selection
- **Zero Overhead**: Minimal performance impact from multiple reporters

---

# Runtime Behavior

## Overview
Deep runtime integration with environment setup, error handling, and CLI inheritance.

## Environment Configuration
- **NODE_ENV**: Automatically set to "test" unless configured
- **Timezone**: Defaults to UTC (Etc/UTC) for consistent date/time behavior
- **Override Support**: Environment variables and .env files take precedence

## Test Execution
- **Default Timeout**: 5000ms per test with `--timeout` override
- **Timeout Behavior**: Uncatchable exceptions with child process cleanup
- **Zombie Process Management**: Automatic cleanup of orphaned processes

## Error Handling
- **Unhandled Errors**: Captures promise rejections and exceptions between tests
- **Exit Code Impact**: Non-zero exit even if all tests pass
- **Higher Precedence**: Overrides standard Node.js error handling

## CLI Flag Inheritance
- **Memory**: `--smol` for reduced VM memory usage
- **Debugging**: `--inspect`, `--inspect-brk` for debugger attachment
- **Module Loading**: `--preload`, `--define`, `--loader`, `--tsconfig-override`
- **Installation**: Network and registry configuration inheritance

## Global Variables
- **Auto-Injection**: `test`, `it`, `describe`, `expect` without imports
- **Lifecycle Hooks**: `beforeAll`, `beforeEach`, `afterAll`, `afterEach`
- **Compatibility**: `jest`, `vi` objects for migration support

---

# Snapshot Testing

## Overview
Output capture and comparison system with external files and inline snapshots.

## Basic Snapshots
- **Matcher**: `.toMatchSnapshot()` serializes and stores output
- **Storage**: `__snapshots__` directory alongside test files
- **Update**: `bun test --update-snapshots` regenerates all snapshots

## Inline Snapshots
- **Matcher**: `.toMatchInlineSnapshot()` stores directly in test files
- **Auto-Update**: First run inserts snapshot into source code
- **Portability**: No external files, snapshots travel with tests
- **Visibility**: Expected output visible next to test logic

## Error Snapshots
- **Error Matching**: `.toThrowErrorMatchingSnapshot()` captures error messages
- **Inline Errors**: `.toThrowErrorMatchingInlineSnapshot()` for inline error capture
- **Regression Prevention**: Catch unintended error message changes

## Best Practices
- **Meaningful Content**: Capture stable, meaningful output
- **Regular Updates**: Update when intentional changes occur
- **Review Process**: Always review snapshot changes in code review
- **Size Considerations**: Use inline for small, files for large snapshots

## Use Cases
- **UI Components**: Rendered component output verification
- **API Responses**: Complex response object validation
- **Configuration**: Generated config file verification
- **Error Messages**: Consistent error reporting validation

---

# Time Manipulation

## Overview
System time control for deterministic date/time testing with Jest compatibility.

## Core Functions
- **setSystemTime()**: Primary time manipulation function
- **Jest Compatibility**: `jest.useFakeTimers()`, `jest.useRealTimers()`
- **Supported APIs**: `Date.now`, `new Date()`, `Intl.DateTimeFormat`

## Usage Patterns
```typescript
// Set specific time
setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
expect(new Date().getFullYear()).toBe(2020);

// Reset to real time
setSystemTime(); // no arguments
```

## Timezone Management
- **Default**: UTC (Etc/UTC) for all test runs
- **Override**: `TZ=America/Los_Angeles bun test` or `process.env.TZ`
- **Runtime Changes**: Switch timezones within test execution
- **Consistency**: Predictable behavior across environments

## Jest Compatibility Advantages
- **Constructor Stability**: `Date === Date` before/after `useFakeTimers`
- **Performance**: No constructor replacement overhead
- **Debugging**: Easier debugging without constructor wrapping
- **Reliability**: Reduced complexity from stable Date constructor

## Time Queries
- **jest.now()**: Returns current mocked timestamp
- **Consistency**: Same value as `Date.now()` when mocked
- **Direct Access**: Timestamp without Date object creation

## Limitations
- **Timers**: setTimeout/setInterval not yet supported (roadmap item)
- **Manual Reset**: No automatic reset between tests

---

# Writing Tests

## Overview
Jest-compatible API with modern enhancements, comprehensive matchers, and flexible organization.

## Basic Structure
- **Test Definition**: `test()` or `it()` functions
- **Grouping**: `describe()` blocks for organization
- **Assertions**: `expect()` with extensive matcher library
- **Auto-Import**: Global functions without explicit imports

## Test Control
- **Selective Execution**: `test.only()`, `describe.only()`
- **Skip Tests**: `test.skip()` excludes from execution
- **Todo Marking**: `test.todo()` for planned tests
- **Conditional**: `test.if(condition)`, `test.skipIf(condition)`
- **Expected Failures**: `test.failing()` for known issues

## Parametrized Testing
- **test.each()**: Multiple data sets for same test
- **describe.each()**: Test suites with parameters
- **Format Specifiers**: `%p` (pretty), `%s` (string), `%d` (number), `%#` (index)

## Async Support
- **Promise-based**: Full `async/await` support
- **Callback Style**: `done` parameter for legacy async
- **Timeout Control**: Per-test timeout as third parameter

## Assertion Counting
- **expect.hasAssertions()**: Ensures at least one assertion
- **expect.assertions(count)**: Requires exact assertion count
- **Async Safety**: Prevents false positives

## Comprehensive Matchers
- **Equality**: `.toBe()`, `.toEqual()`, `.toStrictEqual()`
- **Truthiness**: `.toBeTruthy()`, `.toBeFalsy()`, `.toBeDefined()`
- **Collections**: `.toContain()`, `.toHaveLength()`, `.toContainEqual()`
- **Numeric**: `.toBeGreaterThan()`, `.toBeCloseTo()`
- **Async**: `.resolves`, `.rejects`
- **Mocks**: `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()`
- **Snapshots**: `.toMatchSnapshot()`, `.toMatchInlineSnapshot()`

## Advanced Features
- **Custom Matchers**: `.extend()` for application-specific assertions
- **Pattern Matching**: `.stringContaining()`, `.arrayContaining()`
- **Jest Migration**: Drop-in replacement for most Jest features

---

## Quick Reference

### Essential Commands
```bash
bun test                    # Run all tests
bun test --watch           # Watch mode
bun test --coverage        # With coverage
bun test utils             # Filter by path
bun test --only            # Only .only() tests
```

### Key Configuration
```toml
[test]
root = "src"                           # Limit test discovery
coverage = true                        # Always enable coverage
coverageThreshold = 0.9               # Require 90% coverage
smol = true                           # Reduce memory usage
preload = ["./setup.ts"]              # Global setup
```

### Common Patterns
```typescript
// Basic test structure
describe("feature", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());
  
  test("should work", () => {
    expect(result).toBe(expected);
  });
});

// Mocking
const mockFn = mock(() => "result");
spyOn(object, "method");
mock.module("./module", () => ({ exported: "value" }));

// Snapshots
expect(output).toMatchSnapshot();
expect(output).toMatchInlineSnapshot();
```

**Generated with Abigail's blessing** ⚡  
*Now go write some tests that don't suck*