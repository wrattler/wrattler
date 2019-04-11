## Racket service for Wrattler

Requires:

 - [Racket](https://racket-lang.org/) version 7.1 or greater
 - the Racket [data-frame](https://pkgs.racket-lang.org/package/data-frame) package (install with `raco pkg install data-frame`)

Start the server (by default on port 7104) by running
```
./start-racket-service
```
from within this directory.

### Limitations

 - no attempt at integrating it with the front end
 - doesn't use CORS
 - no plots/figures
 - frames imported by a cell are always re-exported
