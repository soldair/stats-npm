# stats-npm

this was made to help understand ntworking issues like ECONNRESET in npm 
folks reported it here. https://github.com/npm/registry/issues/10


```
sudo npm install -g stats-npm
```

then us it just like npm.

```
snpm install yourmodule
```

after every command it appends profiling information for requests to  `./snpm-stats.log`


you may also run it as a standalone server and configure it as your registry. request metadata is logged to stdout.


```
stats-npm-server --help
```
