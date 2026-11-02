// Deploy pipeline (Jenkins on hserver): test -> build -> deploy.
// Shared library: github.com/hangelify/jenkins-budget (vars/deployApp.groovy).
@Library('jenkins-lib') _
deployApp(app: 'budget', service: 'web', image: 'budget-web')
