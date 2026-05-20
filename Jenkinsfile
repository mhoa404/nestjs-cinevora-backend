/*
Jenkinsfile — Cinevora Backend CI/CD Pipeline
Cinevora Backend — Declarative CI/CD Pipeline
Required Jenkins Credentials:
  - 'docker-hub-credentials' : Username/Password for Docker Hub
  - 'deploy-ssh-key'         : SSH private key for deployment server
  - 'deploy-server-ip'       : Secret text containing server IP/hostname
*/

pipeline {
    agent any
    
    // Environment Variables
    environment {
        DOCKER_IMAGE      = 'cinevora/backend'
        DOCKER_TAG        = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'unknown'}"
        DOCKER_LATEST_TAG = 'latest'
        DEPLOY_USER       = 'deploy'
        DEPLOY_PATH       = '/opt/cinevora/backend'
        REPO_URL          = scm.userRemoteConfigs[0].url
    }

    // Pipeline Options
    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
    }

    // Trigger: only on main branch
    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        // Stage 1: Checkout
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_COMMIT_MSG = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()
                    echo "🔄 Building commit: ${env.GIT_COMMIT_SHORT}"
                    echo "📝 Message: ${env.GIT_COMMIT_MSG}"
                }
            }
        }

        // Stage 2: Build Docker Image
        stage('Build') {
            steps {
                script {
                    echo "[Info] Building Docker image: ${DOCKER_IMAGE}:${DOCKER_TAG}"
                    docker.build(
                        "${DOCKER_IMAGE}:${DOCKER_TAG}",
                        "--no-cache " +
                        "--build-arg BUILD_DATE=\$(date -u +'%Y-%m-%dT%H:%M:%SZ') " +
                        "--build-arg VCS_REF=${env.GIT_COMMIT_SHORT} " +
                        "-f Dockerfile ."
                    )
                }
            }
        }

        // Stage 3: Test
        stage('Test') {
            parallel {
                stage('Lint') {
                    steps {
                        script {
                            echo "🔍 Running linter..."
                            sh """
                                docker build --target build -t ${DOCKER_IMAGE}:test-${DOCKER_TAG} .
                                docker run --rm ${DOCKER_IMAGE}:test-${DOCKER_TAG} pnpm lint
                            """
                        }
                    }
                }
                // Verify production image health
                stage('Security Check') {
                    steps {
                        script {
                            echo "[Security] Verifying non-root user..."
                            def user = sh(
                                script: "docker run --rm ${DOCKER_IMAGE}:${DOCKER_TAG} whoami",
                                returnStdout: true
                            ).trim()
                            if (user != 'node') {
                                error("[Error] SECURITY VIOLATION: Container running as '${user}' instead of 'node'")
                            }
                            echo "[Success] Container runs as non-root user: ${user}"

                            echo "[Security] Checking image size..."
                            def size = sh(
                                script: "docker image inspect ${DOCKER_IMAGE}:${DOCKER_TAG} --format='{{.Size}}'",
                                returnStdout: true
                            ).trim()
                            def sizeMB = (size as Long) / (1024 * 1024)
                            echo "[Info] Image size: ${sizeMB} MB"
                            if (sizeMB > 500) {
                                unstable("[Warning] Image size exceeds 500MB threshold: ${sizeMB}MB")
                            }
                        }
                    }
                }
            }
        }

        // Stage 4: Push to Docker Hub
        stage('Push') {
            when {
                branch 'main'
            }
            steps {
                script {
                    echo "[Info] Pushing image to Docker Hub..."
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-credentials') {
                        def image = docker.image("${DOCKER_IMAGE}:${DOCKER_TAG}")
                        image.push()
                        // Push with 'latest' tag
                        image.push("${DOCKER_LATEST_TAG}")
                    }
                    echo "[Success] Image pushed: ${DOCKER_IMAGE}:${DOCKER_TAG}"
                }
            }
        }

        // Stage 5: Deploy via SSH
        // Strategy: SSH into the server, pull the latest image from the registry,
        // clone/pull the repo for docker-compose.yml, then docker compose up.
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    echo "[Info] Deploying to production server..."

                    withCredentials([
                        sshUserPrivateKey(
                            credentialsId: 'deploy-ssh-key',
                            keyFileVariable: 'SSH_KEY',
                            usernameVariable: 'SSH_USER'
                        ),
                        string(
                            credentialsId: 'deploy-server-ip',
                            variable: 'SERVER_IP'
                        ),
                        usernamePassword(
                            credentialsId: 'docker-hub-credentials',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no -i \$SSH_KEY \$SSH_USER@\$SERVER_IP << 'DEPLOY_SCRIPT'
                                set -e

                                echo ">>> Logging into Docker Hub..."
                                echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin

                                echo ">>> Pulling latest image..."
                                docker pull ${DOCKER_IMAGE}:${DOCKER_LATEST_TAG}

                                echo ">>> Cloning/updating repository..."
                                if [ -d "${DEPLOY_PATH}" ]; then
                                    cd ${DEPLOY_PATH}
                                    git fetch origin main
                                    git reset --hard origin/main
                                else
                                    git clone --branch main --single-branch ${REPO_URL} ${DEPLOY_PATH}
                                    cd ${DEPLOY_PATH}
                                fi

                                echo ">>> Starting services with Docker Compose..."
                                docker compose -f docker-compose.prod.yml pull
                                docker compose -f docker-compose.prod.yml up -d --remove-orphans

                                echo ">>> Cleaning up old images..."
                                docker image prune -f

                                echo "[Success] Deployment complete!"
                                docker compose -f docker-compose.prod.yml ps
DEPLOY_SCRIPT
                        """
                    }
                    echo "[Success] Deployment successful!"
                }
            }
        }

        // Stage 6: Cleanup
        stage('Cleanup') {
            steps {
                script {
                    echo "[Info] Cleaning up local Docker artifacts..."
                    sh """
                        docker rmi ${DOCKER_IMAGE}:test-${DOCKER_TAG} || true
                        docker image prune -f --filter "dangling=true"
                    """
                    echo "[Success] Cleanup complete."
                }
            }
        }
    }

    // Post-build Actions
    post {
        success {
            echo "[Success] Pipeline completed successfully for ${DOCKER_IMAGE}:${DOCKER_TAG}"
        }
        failure {
            echo "[Error] Pipeline FAILED for ${DOCKER_IMAGE}:${DOCKER_TAG}"
        }
        always {
            // Clean workspace to prevent disk space issues
            cleanWs()
        }
    }
}
