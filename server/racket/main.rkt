#lang racket

(provide start-racket-service)

(require json
         data-frame
         syntax/strip-context
         net/url
         net/url-structs
         web-server/servlet
         web-server/servlet-env)

;; Provides an alternative form of #%top that doesn't error on unbound
;; identifiers.  Used when identifying the "imports" of a cell.
(module undef-top racket/base
  (define undefined 'undef)
  (define-syntax-rule (#%top . x) '(undefined x))
  (provide #%top undefined))

(require (only-in 'undef-top undefined))

(module+ test (require rackunit))

(define current-datastore (make-parameter "http://localhost:7102"))

(define (datastore-request-url hsh name)
  (string-join (list (current-datastore) hsh name) "/"))

;; Retrieve a frame (: jsexpr?) from the url as a string (url-str)
;; Used for querying the data-store
(define (retrieve-frame url-str)
  (bytes->jsexpr (port->bytes (get-pure-port (string->url url-str)))))

;; store-frame : url? jsexpr? -> boolean?
(define (store-frame url val)
  ;; get headers from the following, and check for error
  (eq? (hash-ref (string->jsexpr
                  (port->string
                   (put-pure-port url (jsexpr->bytes val))))
                 'status_code)
       200))

(define ((hash-keys-exactly? . ks) h)
  (equal? (list->set (hash-keys h)) (apply set ks)))

(define (string->syntax str)
  (read-syntax #f (open-input-string str)))

(define (id->string id)
  (symbol->string (syntax->datum id)))

(define (response/json js)
  (response/xexpr (jsexpr->string js)))

(define (response/404)
  (response 404 #"File not found" (current-seconds)
            TEXT/HTML-MIME-TYPE '() void))

;;; data-frame <-> jsexpr conversions
;; Try to convert data (: jsexpr?) to a data-frame, else return data
(define (jsexpr->maybe-df data)
  (if (and (list? data)
           (andmap hash? data)
           (andmap jsexpr? data)
           (andmap (λ (maybe-row) (equal? (hash-keys (car data))
                                          (hash-keys maybe-row)))
                   data))
      (let ([col-names (hash-keys (car data))]
            [df (make-data-frame)])
        (for ([col-name col-names])
          (define series (make-series
                          (symbol->string col-name)
                          #:data (for/vector ([row data])
                                   (hash-ref row col-name))))
          (df-add-series df series))
        df)
      data))

(define (data-frame->hashes df)
  (define all-series (df-series-names df))
  (for/list ([row (apply in-data-frame/list df all-series)])
    (make-hash (map (λ (k v) (cons (string->symbol k) v)) all-series row))))

;; If df is a data-frame then attempt to convert it to a jsexpr.  If
;; this fails, or if df is not a data-frame, then return (void).
(define/contract (maybe-df->jsexpr df)
  (-> any/c (or/c jsexpr? void?))
  (when (data-frame? df)
    (let ([df-as-hash-tables (data-frame->hashes df)])
      (when (jsexpr? df-as-hash-tables)
        df-as-hash-tables))))

(module+ test
  (define (df-equal? df1 df2)
    (and (equal? (df-series-names df1) (df-series-names df2))
         (for/and ([row1 (apply in-data-frame/list df1 (df-series-names df1))]
                   [row2 (apply in-data-frame/list df2 (df-series-names df2))])
           (equal? row1 row2))))
   
  
  (test-case "data-frame <-> jsexpr"
    (let ([df (make-data-frame)])
      (df-add-series df (make-series "a" #:data #(1 2 3)))
      (df-add-series df (make-series "b" #:data #(4 5 6)))
      (let ([actual   (maybe-df->jsexpr df)]
            [expected (list (hash 'b 4 'a 1)
                            (hash 'b 5 'a 2)
                            (hash 'b 6 'a 3))])
        (check-equal? (map hash->list actual)
                      (map hash->list expected)))

      (define df* (jsexpr->maybe-df (maybe-df->jsexpr df)))
      (check df-equal? df df*))
     
      (check-equal? (maybe-df->jsexpr 1) (void))
      (check-equal? (maybe-df->jsexpr 'a) (void))
      (check-equal? (maybe-df->jsexpr '(1 2 3)) (void))

    (let ([df (make-data-frame)])
      (df-add-series df (make-series "x" #:data #("1" -1)))
      (df-add-series df (make-series "y" #:data #(2 0.0)))
      (df-add-series df (make-series "z" #:data #(4.0 "zero")))
      (define df* (jsexpr->maybe-df (list (hash 'x "1" 'y 2 'z 4.0)
                                          (hash 'x -1 'y 0.0 'z "zero"))))
      (check df-equal? df df*))

    (check-equal? (jsexpr->maybe-df 5) 5)
    (check-equal? (jsexpr->maybe-df (hash 'x 1 'y 2)) (hash 'x 1 'y 2))
    ))

;; stx must be a fully-expanded top-level module form, where each
;; unbound top-level identifier id has replaced with '(undefined id).
;; See `#%top` and `undefined` from module undef-top.
(define (unbound-ids stx)
  (define (recurse stx)
    (syntax-case stx (undefined)
      ['(undefined x) (list #'x)]
      [(x . xs) (append (recurse #'x) (recurse #'xs))]
      [id '()]))
  (remove-duplicates (recurse stx) free-identifier=?))

;; Identify the top-level bindings of stx within the namespace ns
(define (top-level-bindings stx ns)
  (define (recurse stx)
    (define stx*
      (parameterize ([current-namespace ns])
        (expand-to-top-form stx)))
    (syntax-case stx* (begin define-values)
      [(define-values (var ...) expr) (syntax-e #'(var ...))]
      [(begin form ...)
       (apply append (map recurse (syntax-e #'(form ...))))]
      [_ '()]))
  (remove-duplicates (recurse stx) free-identifier=?))

(define (imports/exports payload)
  (define ns (make-base-namespace))
  (define code-raw (string->syntax (hash-ref payload 'code)))

  ;; Expand the code inside a module (so that lifted defines are
  ;; handled as we want them to be), but replace #%top so that it
  ;; doesn't cause an error on unbound identifiers and instead wraps
  ;; the id with a form that can be picked up by `unbound-ids`
  (define code-expanded
    (with-syntax ([code-raw code-raw])
      (parameterize ([current-namespace ns])
        (expand (strip-context
                 #'(module tmp racket/base
                     (require data-frame)
                     (require (only-in (submod "main.rkt" undef-top) #%top))
                     code-raw))))))

  (define explicit-exports (top-level-bindings code-raw ns))
  (define imports (unbound-ids code-expanded))
  (values imports (append imports explicit-exports)))

(define jsexpr-dict/c (hash/c symbol? jsexpr?))
(define payload/c        (and/c jsexpr-dict/c
                                (hash-keys-exactly? 'code 'frames 'hash)))
(define exports-result/c (and/c jsexpr-dict/c
                                (hash-keys-exactly? 'imports 'exports)))
(define eval-result/c    (and/c jsexpr-dict/c
                                (hash-keys-exactly? 'output 'frames 'figures)))

(define/contract (exports/jsexpr payload)
  (-> payload/c exports-result/c)
  (let-values ([(imports exports) (imports/exports payload)])
    (hash 'imports (map id->string imports)
          'exports (map id->string exports))))

;; The namespace in which a cell's contents are to be evaluated
(define/contract (make-cell-namespace bindings)
  (-> (hash/c symbol? any/c) namespace?)
  (let ([ns (make-base-namespace)])
    (namespace-attach-module (current-namespace) 'data-frame ns)
    (namespace-require 'data-frame ns)
    (for ([(id val) bindings])
      (namespace-set-variable-value! id val #f ns))
    ns))

(define/contract (eval/jsexpr payload)
  (-> payload/c eval-result/c)
  (define cell-contents (hash-ref payload 'code))
  (define code-hash     (hash-ref payload 'hash))
  (define frame-urls    (hash-ref payload 'frames))

  (define-values (imports exports) (imports/exports payload))
  
  (define bindings
    (for/hash ([(frame-id frame-url) frame-urls])
      (values frame-id (jsexpr->maybe-df (retrieve-frame frame-url)))))

  ;; Evaluate the cell, capturing the result (a hash table containing
  ;; the exports) and the console output
  (define-values (result console-output)
    (let ([ns (make-cell-namespace bindings)]
          ;; construct the code to evaluate, returning the output frames
          [code (with-syntax ([body (string->syntax cell-contents)]
                              [(exports ...) exports])
                  (strip-context
                   #'(begin
                       body
                       (make-hash (list (cons 'exports exports) ...)))))])
      
      (define console (open-output-string))
      (define/contract result (hash/c symbol? any/c)
        (parameterize ([current-output-port console])
          (eval code ns)))
      (values result (get-output-string console))))
  
  ;; Write values to the data store
  (define output-frame-urls
    (for/fold ([acc (hash)])
              ([(k v) result])
      (define val (maybe-df->jsexpr v))
      (if (void? val)
          acc
          (let ([url-str (datastore-request-url code-hash (symbol->string k))])
            (unless (store-frame (string->url url-str) val)
              (raise-user-error
               (string-append
                "Error: failed to write a data frame with ~a rows to the "
                "data-store at ~a")
               (df-row-count v) url-str))
            (hash-set acc k url-str)))))
  
  (hash 'output console-output
        'frames output-frame-urls
        'figures '()))


(module+ test
  (define (check-imports-exports expect-imports expect-exports code-stx)
    (let* ([code-str (~a (syntax->datum code-stx))]
           [payload  (hash 'code code-str 'frames '[] 'hash "ignored")]
           [actual   (exports/jsexpr payload)]
           [actual-imports (hash-ref actual 'imports)]
           [actual-exports (hash-ref actual 'exports)])
      (check-equal? (list->set actual-imports)
                    (list->set expect-imports))
      (check-equal? (list->set actual-exports)
                    (list->set expect-exports))))
  
  (test-case "exports"
    (check-imports-exports '[]    '[]    #'1)
    (check-imports-exports '[]    '["a"] #'(define a 1))
    (check-imports-exports '["a"] '["a"] #'a)
    (check-imports-exports '["c" "w"] '["c" "w" "x" "a" "b"]
                           #'(begin
                               (define x (make-data-frame))
                               (define-values (a b) (values 1 2))
                               (let ([p 0]
                                     [c c])
                                 (define y c) w))))

  (test-case "eval" (void)) ;; TODO: tests of eval (mocking the datastore)
  )


(define (run req)
  (let ([post-data-json (bytes->jsexpr (request-post-data/raw req))])
    (match (url->string (request-uri req))
      ["/exports" (response/json (exports/jsexpr post-data-json))]
      ["/eval"    (response/json (eval/jsexpr post-data-json))]
      [_          (response/404)])))

;; entry point: start the server on the indicated port, using the
;; datastore at datastore-url (: string?)
(define (start-racket-service [datastore-url (current-datastore)]
                              #:port [port 7104])
  (parameterize ([current-datastore datastore-url])
    (serve/servlet run
                   #:servlet-regexp #rx""
                   #:port port
                   #:launch-browser? #f
                   #:stateless? #t)))
