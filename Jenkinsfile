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