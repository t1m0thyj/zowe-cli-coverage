# Zowe CLI Coverage

Calculates test coverage metrics for Zowe CLI and plugins.

## Configure Projects

Edit the [config.yaml](./config.yaml) file to configure the list of repositories that are scanned.

Below is an example config file with comments:
```yaml
projects:
  "zowe/zowe-cli":  # Name of GitHub repository
    # Run "test:unit" NPM script and count number of tests.
    # Specify path where "lcov.info" is located to gather coverage results.
    unit: __tests__/__results__/unit/coverage
    # Run "test:integration" NPM script and count number of tests.
    # `true` = Tests will run without reporting any coverage information.
    integration: true
    # Dry-run "test:system" NPM script and count number of tests.
    # `false` = Test files will be scanned for number of "it" statements.
    system: false
```

## Generate Reports

Reports are automatically generated in the [results](./results) folder weekly.

To manually generate a report, run the [Zowe CLI Coverage](https://github.com/t1m0thyj/zowe-cli-coverage/actions/workflows/coverage.yaml) workflow.
