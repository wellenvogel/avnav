# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013-2021 Andreas Vogel andreas@wellenvogel.net
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
#  parts contributed by free-x https://github.com/free-x
#  parts contributed by Matt Hawkins http://www.raspberrypi-spy.co.uk/
#
###############################################################################

from ctypes import c_short
from bme280 import ParamHex

hasBMP180=False
try:
  import smbus
  hasBMP180=True
except:
  pass

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
import avnav_handlerList


def convertToString(data):
  # Simple function to convert binary data into
  # a string
  return str((data[1] + (256 * data[0])) / 1.2)

def getShort(data, index):
  # return two bytes from data as a signed 16-bit value
  return c_short((data[index] << 8) + data[index + 1]).value

def getUshort(data, index):
  # return two bytes from data as an unsigned 16-bit value
  return (data[index] << 8) + data[index + 1]

def readBmp180Id(bus,addr):
  if bus is None:
    return (0,0)
  # Chip ID Register Address
  REG_ID     = 0xD0
  (chip_id, chip_version) = bus.read_i2c_block_data(addr, REG_ID, 2)
  return (chip_id, chip_version)


def readBmp180(bus,addr):
  if bus is None:
    return (1,2)
  # Register Addresses
  REG_CALIB  = 0xAA
  REG_MEAS   = 0xF4
  REG_MSB    = 0xF6
  REG_LSB    = 0xF7
  # Control Register Address
  CRV_TEMP   = 0x2E
  CRV_PRES   = 0x34 
  # Oversample setting
  OVERSAMPLE = 3    # 0 - 3
  
  # Read calibration data
  # Read calibration data from EEPROM
  cal = bus.read_i2c_block_data(addr, REG_CALIB, 22)

  # Convert byte data to word values
  AC1 = getShort(cal, 0)
  AC2 = getShort(cal, 2)
  AC3 = getShort(cal, 4)
  AC4 = getUshort(cal, 6)
  AC5 = getUshort(cal, 8)
  AC6 = getUshort(cal, 10)
  B1  = getShort(cal, 12)
  B2  = getShort(cal, 14)
  MB  = getShort(cal, 16)
  MC  = getShort(cal, 18)
  MD  = getShort(cal, 20)

  # Read temperature
  bus.write_byte_data(addr, REG_MEAS, CRV_TEMP)
  time.sleep(0.005)
  (msb, lsb) = bus.read_i2c_block_data(addr, REG_MSB, 2)
  UT = (msb << 8) + lsb

  # Read pressure
  bus.write_byte_data(addr, REG_MEAS, CRV_PRES + (OVERSAMPLE << 6))
  time.sleep(0.04)
  (msb, lsb, xsb) = bus.read_i2c_block_data(addr, REG_MSB, 3)
  UP = ((msb << 16) + (lsb << 8) + xsb) >> (8 - OVERSAMPLE)

  # Refine temperature
  X1 = ((UT - AC6) * AC5) >> 15
  X2 = (MC << 11) / (X1 + MD)
  B5 = X1 + X2
  temperature = int(B5 + 8) >> 4

  # Refine pressure
  B6  = B5 - 4000
  B62 = int(B6 * B6) >> 12
  X1  = (B2 * B62) >> 11
  X2  = int(AC2 * B6) >> 11
  X3  = X1 + X2
  B3  = (((AC1 * 4 + X3) << OVERSAMPLE) + 2) >> 2

  X1 = int(AC3 * B6) >> 13
  X2 = (B1 * B62) >> 16
  X3 = ((X1 + X2) + 2) >> 2
  B4 = (AC4 * (X3 + 32768)) >> 15
  B7 = (UP - B3) * (50000 >> OVERSAMPLE)

  P = (B7 * 2) / B4

  X1 = (int(P) >> 8) * (int(P) >> 8)
  X1 = (X1 * 3038) >> 16
  X2 = int(-7357 * P) >> 16
  pressure = int(P + ((X1 + X2 + 3791) >> 4))

  return (temperature/10.0,pressure/100.0)


class AVNBMP180Reader(AVNWorker):
  """ a worker to read data from the BMP180 module
    and insert it as NMEA MDA/XDR records
  """
  P_INTERVAL=WorkerParameter('interval', '5',
                             type=WorkerParameter.T_FLOAT,
                             description="interval in seconds between measures")
  P_WRITEMDA=WorkerParameter('writeMda', True,
                             type=WorkerParameter.T_BOOLEAN,
                             description="write MDA records")
  P_WRITEXDR=WorkerParameter('writeXdr', True,
                             type=WorkerParameter.T_BOOLEAN,
                             description="write XDR records")
  P_NAMEPRESS=WorkerParameter('namePress', 'Barometer',
                              description="XDR transducer name for pressure")
  P_NAMETEMP=WorkerParameter('nameTemp', 'TempAir',
                             description="XDR transducer name for temperature")
  P_ADDR=ParamHex('addr', '0x77',
                         description='I2C address for the BME in 0xnn notation')
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = [
      # if this one is set, we do not use the defaul feeder but this one
      cls.PRIORITY_PARAM_DESCRIPTION,
      cls.P_INTERVAL,
      cls.P_WRITEMDA,
      cls.P_WRITEXDR,
      cls.P_NAMEPRESS,
      cls.P_NAMETEMP,
      cls.P_ADDR
    ]
    return rt

  @classmethod
  def canEdit(cls):
    return hasBMP180

  @classmethod
  def canDeleteHandler(cls):
    return hasBMP180

  @classmethod
  def canDisable(cls):
    return True

  def isDisabled(self):
    if not hasBMP180:
      return True
    return super().isDisabled()


  # thread run method - just try forever
  def run(self):
    bus=None
    if hasBMP180:
      try:
        bus = smbus.SMBus(1)  # Rev 2 Pi, Pi 2 & Pi 3 uses bus 1
      except Exception as e:
        raise Exception("unable to get smbus #1: %s"%str(e))
    else:
      raise Exception("smbus library not installed")
    self.setInfo('main', "reading BMP180", WorkerStatus.NMEA)
    while True:
      addr = self.getWParam(self.P_ADDR)
      priority=self.getWParam(self.PRIORITY_PARAM_DESCRIPTION)
      (chip_id, chip_version) = readBmp180Id(bus,addr)
      self.setInfo('main', "reading BMP180 id=%d, version=%d"%(chip_id,chip_version), WorkerStatus.NMEA)
      source = self.getSourceName(addr)
      try:
        temperature,pressure = readBmp180(bus,addr)
        if self.getWParam(self.P_WRITEMDA):
          """$AVMDA,,,1.00000,B,,,,,,,,,,,,,,,,"""
          mda = '$AVMDA,,,%.5f,B,,,,,,,,,,,,,,,,' % ( pressure / 1000.)
          AVNLog.debug("BMP180:MDA %s", mda)
          self.queue.addNMEA(mda,source,addCheckSum=True,sourcePriority=priority)
          """$AVMTA,19.50,C*2B"""
          mta = '$AVMTA,%.2f,C' % (temperature)
          AVNLog.debug("BMP180:MTA %s", mta)
          self.queue.addNMEA(mta,source,addCheckSum=True,sourcePriority=priority)
        if self.getWParam(self.P_WRITEXDR):
          tn = self.getWParam(self.P_NAMEPRESS)
          xdr = '$AVXDR,P,%.5f,B,%s' % (pressure / 1000.,tn)
          AVNLog.debug("BMP180:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.getWParam(self.P_NAMETEMP)
          xdr = '$AVXDR,C,%.2f,C,%s' % (temperature,tn)
          AVNLog.debug("BMP180:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
      except:
        AVNLog.info("exception while reading data from BMP180 %s" ,traceback.format_exc())
      wt = self.getWParam(self.P_INTERVAL)
      if not wt or wt < 0.5:
        wt = 5.0
      self.wait(wt)


avnav_handlerList.registerHandler(AVNBMP180Reader)
