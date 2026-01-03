# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2026 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py
###############################################################################
import shutil
import urllib.request
import urllib.parse

import avnav_handlerList
from avnav_util import AVNUtil, AVNLog
from avnav_worker import AVNWorker
from httphandler import AVNHTTPHandler


class AVNProxy(AVNWorker):
    ATYPE='proxy'
    def __init__(self,cfg):
        AVNWorker.__init__(self,cfg)

    @classmethod
    def autoInstantiate(cls):
        return True

    @classmethod
    def preventMultiInstance(cls):
        return True

    @classmethod
    def getConfigParam(cls, child=None):
        return [cls.ENABLE_PARAM_DESCRIPTION]

    def getApiType(self):
        return self.ATYPE
    HDR_BLACKLIST=['host']
    OK_STATS=[200,301]
    def handleProxyRequest(self,url,handler:AVNHTTPHandler):
        status=500
        try:
            parsed=urllib.parse.urlparse(url)
            parsed=parsed._replace(path=urllib.parse.quote_plus(parsed.path,safe='/'))
            constructed=urllib.parse.urlunparse(parsed)
            request = urllib.request.Request(constructed)
            headers = handler.headers
            for k, v in headers.items():
                if k.lower() in self.HDR_BLACKLIST:
                    continue
                request.add_header(k, v)
            request.method = handler.command
            response = urllib.request.urlopen(request)
            status=response.status
            if status not in self.OK_STATS:
                raise Exception(f"request error:{response.reason}")
            handler.send_response_only(status)
            for k, v in response.getheaders():
                if k.lower() == 'location' and status == 301:
                    v="http://"+self.getRequestIp(handler)+":"+handler.server.server_address[1]+self.getHandledPath()+"/"+urllib.parse.quote(v)
                handler.send_header(k, v)
            handler.end_headers()
            shutil.copyfileobj(response.fp, handler.wfile)
            return
        except Exception as e:
            AVNLog.debug("proxy request for %s failed: %s", constructed,str(e))
            handler.send_error(status,str(e))

    def handleApiRequest(self, command, requestparam, handler:AVNHTTPHandler=None, **kwargs):
        if handler is None:
            raise Exception("proxy needs handler")
        if command == 'request':
            url=AVNUtil.getHttpRequestParam(requestparam,'url',mantadory=True)
            self.handleProxyRequest(url,handler)
            return
        raise Exception(f"invalid proxy command: {command}")

    def handlePathRequest(self, path, requestparam, server=None, handler=None):
        path=path[len(self.getHandledPath())+1:]
        self.handleProxyRequest(path, handler)
        return True

    def getHandledPath(self):
        return "/"+self.ATYPE


avnav_handlerList.registerHandler(AVNProxy)


