# dexio

Declarative Extensible Framework for Integration Tests.

**--- In development ---**

Goal of this project is to create a framework for running and writing integrations tests of various services in a declarative-fasion.

The Dexio framework will provide modules to test various services such as APIs and databases. It will be possible to combine this modules in a single test.

## Why?

Because complex applications which consist of multiple services such as application servers, databases or brokers must be tested as a single system.

## Planned Modules

- REST API (as HTTP)
- MySQL
- PostgreSQL
- InfluxDB
- MQTT
- RabbitMQ
- Redis

## Example Tests

```yaml
# test/api/main.yaml
name: api
description: Application server API
tags:
  - config
  - api
params:
  apiPrefix: https://api.myapp.tld
---
# test/api/auth.yaml
name: api.auth
description: Tests the authorization process
tags:
  - auth
params:
  validUsername: test
  validPassword: test
tests:
  # ----------------------------------------------------------------
  - description: Try to log in with valid credentials
    tasks:
      - module: http.post
        url: ${apiPrefix}/login
        body:
          jsonData:
            username: ${validUsername}
            password: ${validPassword}
        expect:
          code: 200
          body:
            jsonSchema:
              type: object
              required:
              - token
              properties:
                token:
                  type: string
          set:
            authToken: $.token

      - module: http.get
        url: ${apiPrefix}/user
        auth:
          bearer: ${token}
        expect:
          code: 200
          body:
            jsonSchema:
              type: object
              required:
              - username
              properties:
                username:
                  type: string

      - module: redis
        command: HGET online_users test
        expect:
          result:
            - "1"

  # ---------------------------------------------------------------- 
  - description: Try to log in with invalid credentials
    tasks:
      - module: postgresql.query
        query: "SELECT invalid_logins FROM `users` WHERE `username` = 'test'"
        expect:
          rowCount: 1
        set:
          invalid_logins: $.rows[0].invalid_logins

      - module: http.post
        url: ${apiPrefix}/login
        body:
          jsonData:
            username: testxxx
            password: testxxx
        expect:
          code: 404

      - module: http.get
        url: ${apiPrefix}/user
        auth:
          bearer: ${token}
        expect:
          code: 401

      - module: postgresql.query
        query: "SELECT invalid_logins FROM `users` WHERE `username` = 'test'"
        expect:
          rows:
            - invalid_logins: ">= ${invalid_logins}"
---
# test/mqtt/main.yaml
name: mqtt
description: MQTT broker test
tags:
  - broker
  - mqtt
params:
  brokerUrl: mqtts://broker.myapp.tld
  rabbitUrl: amqp://localhost
---
# test/mqtt/pubsub.yaml
name: mqtt.pubsub
description: Tests the pub sub functionality
tests:
  # ----------------------------------------------------------------
  - description: Try to publish message and check if was delivered into RabbitMQ
    tasks:
      - module: mqtt.publish
        id: mqtt-publish
        url: ${brokerUrl}
        topic: test
        payload: Hello world!
      
      - module: rabbitmq.subscribe
        runBeforeAndWait: mqtt-publish
        url: ${rabbitUrl}
        exchange: amq.topic
        routingKey: test
        expect:
          payload: Hello world!
          headers:
            x-my-header: from-broker

  # ----------------------------------------------------------------
  - description: Try to subscribe for a message
    tasks:
      - module: rabbitmq.publish
        id: amq-publish
        url: ${rabbitUrl}
        exchange: amq.topic
        routingKey: test
        payload: Hello world!
      
      - module: mqtt.subscribe
        runBeforeAndWait: amq-publish
        url: ${brokerUrl}
        topic: test
        expect:
          payload: Hello world!
```

# License Apache 2.0

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