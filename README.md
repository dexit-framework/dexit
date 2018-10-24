# dexit

Declarative Extensible Integration Testing framework.

The Dexit aims to create a framework for integration testing of complex applications which consist of various services such as API servers, databases, pub/sub systems and so on. The Dexit allows you to easily test these services altogether.

**Why declarative approach instead of programming?**

- Because most of the integrations tests are about requesting or querying some service and then checking its response.
- A declarative approach using YAML files is more understandable even for non-programmers.
- For some people seems to be more readable.
- Easy inheritance of configuration and parameters.

## Usage

### Stand-alone Project

```bash
cd your_project_dir

# Create folder for tests
mkdir -p ./tests

# Create a new Node.JS module
npm init

# Install Dexit
npm install --save @dexit/dexit

# Install additional modules (currently not working)
# npm install --save @dexit/module-http
# npm install --save @dexit/module-mqtt
# npm install --save @dexit/reporter-junit

# Customize Dexit configuration using package.json
nano package.json

# Run tests
./node_modules/.bin/dexit

# Or if you install dexit globally
dexit

# Or if you add npm script as shown below...
npm run test
```

### As a Part of an Existing Node.JS Project

```bash
cd your_project_dir

# Create folder for tests
mkdir -p ./tests

# Install Dexit
npm install --save @dexit/dexit

# Install additional modules (currently not working)
# npm install --save @dexit/module-http
# npm install --save @dexit/module-mqtt
# npm install --save @dexit/reporter-junit

# Customize Dexit configuration using package.json
nano package.json

# Run tests
./node_modules/.bin/dexit

# Or if you install dexit globally
dexit

# Or if you add npm script as shown below...
npm run test
```

### Configuration

Configuration can be done via `package.json` file or using command line arguments.

For command line arguments run `dexit -h` or `./node_modules/.bin/dexit -h`.

**Example configuration with default values using package.json file:**

```json
{
  "name": "demo",
  "version": "1.0.0",
  "scripts": {
    "test": "./node_modules/.bin/dexit -h"
  },
  "dependencies": {
    "@dexit/dexit": "*"
  },
  "dexit": {
    "reporters": {
      "console": {
        "detailed": false,
        "reportValidTasks": false,
        "reportArgs": false
      }
    },
    "ignoreInvalidTests": true,
    "loadBuiltInModules": true,
    "autoloadModules": true,
    "testsPath": "./tests",
    "modulesPath": "./node_modules"
  }
}
```

**Example of CLI Help:**

```
usage: dexit [-h] [-v] [--base-path BASEPATH] [--modules-path MODULESPATH]
              [--no-autoload] [--no-builtin] [--ignore-invalid]
              [--reporter [module_name [module_name ...]]] [--debug]
              [--generate-schema schema_filename]
              [testsPath [testsPath ...]]

DEXIT v0.1.0 (Declarative Extensible Integration Testing)

Positional arguments:
  testsPath             Tests directory path

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  --base-path BASEPATH  Base project path
  --modules-path MODULESPATH
                        Node modules path
  --no-autoload         Disable autoloading of modules
  --no-builtin          Disable autoloading of built-in modules
  --ignore-invalid      Ignore invalid test files
  --reporter [module_name [module_name ...]]
                        Use reporter (default: console)
  --debug               Print bootstrap debug messages
  --generate-schema schema_filename
                        Generate JSON schema for test files including all
                        loaded modules definitions. Can be used for linters
                        or language servers to enable intellisense. No tests
                        will be run when this option is set.
```

## Built-in Testing Modules

- JavaScript code execution

## Built-in Reporters

- Console

## Planned Official Modules

- REST API (as HTTP)
- Shell commands execution
- MySQL
- PostgreSQL
- InfluxDB
- MQTT
- RabbitMQ
- Redis

## Planned Official Reporters

- JUnit
- JSON
- HTML

## Documentation

Will be published soon.

## IntelliSense for VS Code

In Visual Studio Code, you can enable IntelliSense features for your test files as follows.

1. Install [YAML Support by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension
2. Generate JSON schema file for your project using `./node_modules/.bin/dexit --generate-schema ./schema.json`
3. Create a new workspace for your project (or use absolute path starting with `file://` in step 4)
4. Add following properties to your workspace configuration:
```json
"settings": {
  "yaml.schemas": {
    "./schema.json": "tests/***.yaml"
  }
}
```
5. Enjoy

## License Apache 2.0

Copyright 2018 Jiri Hybek <jiri@hybek.cz>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.