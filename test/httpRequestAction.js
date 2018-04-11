const jsonata    = require('@elastic.io/jsonata-moment');
const { stub }   = require('sinon');
const { expect } = require('chai');
const nock       = require('nock');

const messages = require('elasticio-node').messages;

const processAction = require('../lib/actions/httpRequestAction').process;

describe('httpRequest action', () => {
    let messagesNewMessageWithBodyStub;

    before(() => {
        messagesNewMessageWithBodyStub =
            stub(messages, 'newMessageWithBody').returns(Promise.resolve());
    });

    describe('when all params is correct', () => {
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach((method, index) => {
            it(`should properly execute ${method} request`, async () => {
                const msg = {
                    body: {
                        url: 'http://example.com'
                    }
                };

                const cfg = {
                    reader: {
                        url: 'url',
                        method
                    },
                    auth: {}
                };

                const responseMessage = {message: `hello world ${index}`};

                nock(jsonata(cfg.reader.url).evaluate(msg.body))
                    .intercept('/', method)
                    .delay(20 + Math.random() * 200)
                    .reply(function (uri, requestBody) {
                        return [
                            200,
                            responseMessage
                        ];
                    });

                await processAction(msg, cfg);

                expect(messagesNewMessageWithBodyStub.getCall(index).args[0])
                    .to.deep.equal(responseMessage);
            });
        });

        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
            it(`jsonata correctness ${method} test`, async() => {
                const msg = {body: {}};
                const cfg = {
                    reader: {
                        url: '"http://example.com/bar?foo=" & $moment(1519834345000).format()',
                        method: method,
                        headers: [
                            {
                                key: 'SampleHeader',
                                value: '$moment(1519834345000).format()'
                            }
                        ]
                    },
                    auth: {}
                };

                if (method !== 'GET') {
                    cfg.reader.body =  {
                        raw: '$moment(1519834345000).format()',
                        encoding: 'raw'
                    }
                }

                // Due to different timezones of developers and production server we can not hardcode expected evaluation result
                const sampleHeaderValue = jsonata('$moment(1519834345000).format()').evaluate({});
                expect(sampleHeaderValue.includes('2018-02-28')).to.equal(true);

                nock('http://example.com', {
                        reqheaders: {
                            SampleHeader: sampleHeaderValue
                        }
                    })
                    .intercept('/bar?foo=' + sampleHeaderValue, method)
                    .delay(20 + Math.random() * 200)
                    .reply(function(uri, requestBody) {
                        if(method !== 'GET') {
                            expect(sampleHeaderValue.includes('2018-02-28')).to.equal(true);
                        }
                        return [
                            200,
                            "{}"
                        ];
                    });

                await processAction(msg, cfg);
            })
        });

        it('should pass 1 header properly', done => {
            const msg = {
                body: {
                    url: 'http://example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method: 'POST',
                    headers: [
                        {
                            key: 'Content-Type',
                            value: '"text/html; charset=UTF-8"'
                        }
                    ]
                },
                auth: {}
            };

            const responseMessage = `hello world`;

            nock(jsonata(cfg.reader.url).evaluate(msg.body), {
                    reqheaders: {
                        'Content-Type': 'text/html; charset=UTF-8'
                    }
                })
                .intercept('/', 'POST')
                .delay(20 + Math.random() * 200)
                .reply(function(uri, requestBody) {
                    done();
                    return [
                        200,
                        responseMessage
                    ];
                });

            processAction(msg, cfg);
        });

        it('should pass multiple headers properly', done => {
            const msg = {
                body: {
                    url: 'http://example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method: 'POST',
                    headers: [
                        {
                            key: 'Accept',
                            value: '"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"'
                        },
                        {
                            key: 'Keep-Alive',
                            value: '"300"'
                        },
                        {
                            key: 'Connection',
                            value: '"keep-alive"'
                        }
                    ]
                },
                auth: {}
            };

            const responseMessage = `hello world`;

            nock(jsonata(cfg.reader.url).evaluate(msg.body), {
                    reqheaders: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Connection': 'keep-alive',
                        'Keep-Alive': '300',
                    }
                })
                .intercept('/', 'POST')
                .delay(20 + Math.random() * 200)
                .reply(function(uri, requestBody) {
                    done();
                    return [
                        200,
                        responseMessage
                    ];
                });

            processAction(msg, cfg);
        });

        describe('when request body is passed', () => {
            it('should properly pass raw body', done => {
                const msg = {
                    body: {
                        url: 'http://example.com'
                    }
                };

                const rawString = '"Lorem ipsum dolor sit amet, consectetur'
                    + ' adipiscing elit. Quisque accumsan dui id dolor '
                    + 'cursus, nec pharetra metus tincidunt"';

                const cfg = {
                    reader: {
                        url: 'url',
                        method: 'POST',
                        body: {
                            raw: rawString,
                            encoding: 'raw'
                        }
                    },
                    auth: {}
                };

                const responseMessage = `hello world`;

                nock(jsonata(cfg.reader.url).evaluate(msg.body))
                    .post('/', /Lorem\sipsum/gi)
                    .delay(20 + Math.random() * 200)
                    .reply(function(uri, requestBody) {
                        done();
                        return [
                            200,
                            responseMessage
                        ];
                    });

                processAction(msg, cfg);
            });

            it('should properly pass formdata body', done => {
                const msg = {
                    body: {
                        url: 'http://example.com',
                        world: 'world'
                    }
                };

                const cfg = {
                    reader: {
                        url: 'url',
                        method: 'POST',
                        body: {
                            formData: [
                                {
                                    key: 'foo',
                                    value: '"bar"'
                                },
                                {
                                    key: 'baz',
                                    value: '"qwe"'
                                },
                                {
                                    key: 'hello',
                                    value: '"world"'
                                }
                            ],
                            contentType: 'multipart/form-data'
                        },
                        headers: []
                    },
                    auth: {}
                };

                const responseMessage = `hello world`;

                nock(jsonata(cfg.reader.url).evaluate(msg.body))
                    .post('/', function(body) {
                        return body.replace(/[\n\r]/g, '').match(/foo.+bar.+baz.+qwe.+hello.+world/);
                    })
                    .delay(20 + Math.random() * 200)
                    .reply(function(uri, requestBody) {
                        done();
                        return [
                            200,
                            responseMessage
                        ];
                    });

                processAction(msg, cfg);
            });
        });
    });

    describe('when some args are wrong', () => {
        it('should throw error if cfg.reader.method is absent', done => {
            const msg = {
                body: {
                    url: 'example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url'
                },
                auth: {}
            };

            try {
                processAction(msg, cfg);
            } catch (err) {
                expect(err.message).equal('Method is required');

                done();
            }
        });

        it('should throw error if cfg.reader.url is absent', done => {
            const msg = {
                body: {
                    url: 'example.com'
                }
            };

            const cfg = {
                reader: {
                    method: 'GET'
                },
                auth: {}
            };

            try {
                processAction(msg, cfg);
            } catch (err) {
                expect(err.message).equal('URL is required');

                done();
            }
        });

        it('should throw error if cfg.reader.method is wrong', done => {
            const msg = {
                body: {
                    url: 'example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method: 'GETT'
                },
                auth: {}
            };

            try {
                processAction(msg, cfg);
            } catch (err) {
                expect(err.message).equal(
                    `Method "${cfg.reader.method}" isn't one of the: DELETE,GET,PATCH,POST,PUT.`
                );

                done();
            }
        });
    });

    describe('Non-JSON responses', () => {
        it('No response body', async () => {
           const method = 'POST';
           const msg = {
               body: {
                   url: 'http://example.com'
               }
           };

           const cfg = {
               reader: {
                   url: 'url',
                   method
               },
               auth: {}
           };

           const responseMessage = '';

           nock(jsonata(cfg.reader.url).evaluate(msg.body))
               .intercept('/', method)
               .delay(20 + Math.random() * 200)
               .reply(204, responseMessage);

           await processAction(msg, cfg);

           expect(messagesNewMessageWithBodyStub.lastCall.args[0])
               .to.deep.equal({});
       });

        it('Valid XML Response', async () => {
            const method = 'POST';
            const msg = {
                body: {
                    url: 'http://example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method
                },
                auth: {}
            };

            nock(jsonata(cfg.reader.url).evaluate(msg.body))
                .intercept('/', method)
                .delay(20 + Math.random() * 200)
                .reply(200, '<xml>foo</xml>', {
                    'Content-Type': 'application/xml'
                });

            await processAction(msg, cfg);

            expect(messagesNewMessageWithBodyStub.lastCall.args[0])
                .to.deep.equal({xml: 'foo'});
        });

        it('Invalid XML Response', async () => {
            const method = 'POST';
            const msg = {
                body: {
                    url: 'http://example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method
                },
                auth: {}
            };

            nock(jsonata(cfg.reader.url).evaluate(msg.body))
                .intercept('/', method)
                .delay(20 + Math.random() * 200)
                .reply(200, '<xml>foo</xmlasdf>', {
                    'Content-Type': 'application/xml'
                });

            try {
                await processAction(msg, cfg);
                throw new Error("This line should never be called because await above should throw an error");
            } catch (err) {
                // all good
            }
        });
    });

    describe('Some text response without any content type', () => {
        it('No response body', async () => {
            const method = 'POST';
            const msg = {
                body: {
                    url: 'http://example.com'
                }
            };

            const cfg = {
                reader: {
                    url: 'url',
                    method
                },
                auth: {}
            };

            const responseMessage = 'boom!';

            nock(jsonata(cfg.reader.url).evaluate(msg.body))
                .intercept('/', method)
                .delay(20 + Math.random() * 200)
                .reply(function (uri, requestBody) {
                    return [
                        200,
                        responseMessage
                    ];
                });

            try {
                await processAction(msg, cfg);
                throw new Error("This line should never be called because await above should throw an error");
            } catch (err) {
                // all good
            }
        });
    });
});