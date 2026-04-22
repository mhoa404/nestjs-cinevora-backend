# FILE: Jenkinsfile

path: Jenkinsfile
module: root
kind: file
language: groovy
line_count: 49
size_bytes: 814
sha256: d565bd37be5f9749ac1ad6fc88e6aca66f409d3701a681a249cc9f55a5cf6cd7
updated_at: 2026-04-08T04:57:37.334Z

## SYMBOLS
- (none detected)

## CODE

````groovy
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    APP_DIR = "/var/jenkins_home/workspace/${JOB_NAME}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build Backend Image') {
      steps {
        sh '''
          cd "$APP_DIR"
          docker compose build backend
        '''
      }
    }

    stage('Deploy App Services') {
      steps {
        sh '''
          cd "$APP_DIR"
          docker compose pull mysql || true
          docker compose up -d mysql backend
          docker image prune -f
        '''
      }
    }
  }

  post {
    success {
      echo 'Deploy thành công.'
    }
    failure {
      echo 'Deploy thất bại.'
    }
  }
}
````
