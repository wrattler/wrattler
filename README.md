![Build status](https://api.travis-ci.com/wrattler/wrattler.svg?branch=master)

If you get

> ERROR: for wrattler_wrattler_client_1  Cannot create container for service wrattler_client: b'Drive has not been shared'

You need to share your drives in Docker settings ([Windows](https://blogs.msdn.microsoft.com/stevelasker/2016/06/14/configuring-docker-for-windows-volumes/))

But automatic reload does not work on Windows anyway:
See https://github.com/docker/compose/issues/4326 and https://github.com/docker/for-win/issues/56

### To run Wrattler in Jupyterlab

1. In wrattler/client, start up a client docker
  
  ```
  docker run -v <pathToWrattler>/wrattler/client:/app -it wrattler_wrattler_client
  eg.
  docker run -v /Users/myong/Documents/workspace/wrattler/client:/app -it wrattler_wrattler_client 
  ```
  
2. In the runnin `wrattler_wrattler_client`, run the app/build.sh script 
```
laptop-ati0014:client myong$ docker run -v /Users/myong/Documents/workspace/wrattler/client:/app -it wrattler_wrattler_client 
root@a16bb55766f5:/app# ./build.sh
```

3. When building completes, there will be a message as follows:

```
Closing Fable daemon...
Done in 105.49s.
Yarn built - Thanks Nick!
root@2477249e82e9:/app# exit 
```

4. Copy the yarn-built build/wrattler-app.js into the client/public folder so that the client can serve it
```
cp build/wrattler-app.js public/wrattler-app.js
```

5. In wrattler/jupyterlab_wrattler, start jupyterlab environment
```
conda activate jupyterlab-ext
```

6. Build jupyterlab with wrattler mime renderer
```
jlpm run build
eg.
(jupyterlab-ext) laptop-ati0014:jupyterlab_wrattler myong$ 
```

7. In a separate tab, start jupyterlab with wrattler
```
jupyter lab --watch
eg.
(jupyterlab-ext) laptop-ati0014:jupyterlab_wrattler myong$ jupyter lab --watch
```

8. This will provide an address and token. Paste into browser
```
The Jupyter Notebook is running at:
http://localhost:8889/?token=xys
```
