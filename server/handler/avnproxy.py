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
import traceback
import urllib.request
import urllib.parse
from urllib.error import HTTPError

import avnav_handlerList
from avnav_util import AVNUtil, AVNLog, AVNProxyDownload, AVNDownloadError
from avnav_worker import AVNWorker, WorkerStatus
from httphandler import AVNHTTPHandler, RequestException


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
        return []

    @classmethod
    def canEdit(cls):
        return True

    @classmethod
    def canDisable(cls):
        return True

    def run(self):
        self.setInfo('main','running',WorkerStatus.RUNNING)
        while not self.shouldStop():
            self.wait(30000)

    def getApiType(self):
        return self.ATYPE
    HDR_BLACKLIST=['host']
    OK_STATS=[200,206,301,304]
    def handleProxyRequest(self,url,handler:AVNHTTPHandler,requestparam=None):
        status=500
        constructed=url
        try:
            parsed=urllib.parse.urlparse(url)
            parsed=parsed._replace(path=urllib.parse.quote_plus(parsed.path,safe='/').replace('+','%20'))
            constructed=urllib.parse.urlunparse(parsed)
            request = urllib.request.Request(constructed)
            headers = handler.headers
            lcmap = set() #keep the lower case header names to avoid later override
            if requestparam is not None:
                for k,v in requestparam.items():
                    lk=k.lower()
                    if not lk.startswith("h:"):
                        continue
                    lk=lk[2:]
                    k=k[2:]
                    lcmap.add(lk)
                    if isinstance(v,list):
                        v=v[0]
                    request.add_header(k,v)
            for k, v in headers.items():
                lk=k.lower()
                if lk in self.HDR_BLACKLIST or lk in lcmap:
                    continue
                request.add_header(k, v)
            request.method = handler.command
            try:
                response = urllib.request.urlopen(request)
            except HTTPError as httpError:
                if httpError.code in self.OK_STATS:
                    response=httpError.file
                else:
                    raise
            status=response.status
            if status not in self.OK_STATS:
                return AVNDownloadError(status,f"request error:{response.reason}")
            headers={}
            for k, v in response.getheaders():
                if k.lower() == 'location' and status == 301:
                    v="http://"+self.getRequestIp(handler)+":"+handler.server.server_address[1]+self.getHandledPath()+"/"+urllib.parse.quote(v)
                headers[k]=v
            return AVNProxyDownload(status,headers,response.fp,userData=response)
        except Exception as e:
            traceback.print_exc()
            AVNLog.debug("proxy request for %s failed: %s", constructed,str(e))
            return AVNDownloadError(status,str(e))

    def handleApiRequest(self, command, requestparam, handler:AVNHTTPHandler=None, **kwargs):
        if handler is None:
            raise Exception("proxy needs handler")
        if command == 'request':
            url=AVNUtil.getHttpRequestParam(requestparam,'url',mantadory=True)
            return self.handleProxyRequest(url,handler,requestparam)
        raise Exception(f"invalid proxy command: {command}")

    def handlePathRequest(self, path, requestparam, server=None, handler=None):
        return self.handleProxyRequest(path, handler,requestparam)

    def getHandledPath(self):
        return "/"+self.ATYPE


avnav_handlerList.registerHandler(AVNProxy)


