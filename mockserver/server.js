var connect = require('connect'),
  fs = require('fs'),
  serveStatic = require('serve-static'),
  path = require('path'),
  argv = require('yargs').argv,
  ngApimockUtil = require('ng-apimock/lib/utils'),
  ngApimock = require('ng-apimock')(),
  rimraf = require('rimraf');

var ngApimockPath = 'mockserver/generated-mocks';

// delete temp directory
rimraf.sync(ngApimockPath);

// run apimock processing
ngApimock.run({src: path.join(process.cwd(), 'mockserver/mocks'), outputDir: path.join(process.cwd(), ngApimockPath)});

var port = argv.port || 4201;
var distFolder = 'public';

var contextPath = '/';

connect()
  .use(contextPath + '_', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
res.end('OK');
})
.use(contextPath, serveStatic(distFolder))
  .use(contextPath, ngApimockUtil.ngApimockRequest)
  .use('/mocking', serveStatic(path.join(process.cwd(), ngApimockPath)))
  .listen(port);

if (argv.production) {
  console.log('Production mockserver running on port ' + port + '...');
} else {
  console.log('Development mockserver running on port ' + port + '...');
}
