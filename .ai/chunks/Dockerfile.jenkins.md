# FILE: Dockerfile.jenkins

path: Dockerfile.jenkins
module: root
kind: file
language: dockerfile
line_count: 16
size_bytes: 425
sha256: 2960c1d4fe0384fa94114fddd1b4f8e9f7c0cd7b4192fd63196097dc9ba56dae
updated_at: 2026-04-08T04:57:37.334Z

## SYMBOLS
- (none detected)

## CODE

````dockerfile
FROM docker:27-cli AS dockercli

FROM jenkins/jenkins:lts-jdk21

USER root

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER jenkins
````
