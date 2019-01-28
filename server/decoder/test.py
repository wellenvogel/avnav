import threading
import time


class TestDecoder:
  PATH="gps.test"
  def __init__(self):
    self.dataStore=None
    self.feeder=None

  def initialize(self,logger,dataStore,feeder):
    '''
    initialize a decoder
    :param dataStore: the store for the data, it has a method storeData(path,value,timestamp=None)
    :param feeder: the nmea queue, fetch data with fetchFromHistory(sequence,number)
    :return:
    '''
    self.dataStore=dataStore
    self.feeder=feeder
    self.logger=logger
    return {
      'description': 'a test decoder',
      'name': self.__class__.__name__,
      'data': [
        {
          'path':self.PATH,
          'description':'output of testdecoder',
          'unit':''
        }
      ]
    }

  def run(self):
    t=threading.Thread(target=self.handler)
    t.setDaemon(True)
    t.start()
    pass

  def handler(self):
    seq=0
    count=0
    self.logger.log("started")
    while True:
      data=self.feeder.fetchFromHistory(seq,10)
      if len(data) > 0:
        for line in data:
          #do something
          count+=1
          if count%10 == 0:
            self.logger.log("store new value %d"%(count))
            self.dataStore.storeData(self.PATH,count)
            self.dataStore.storeData("wrong.path",count)
          pass
      else:
        time.sleep(0.1)

