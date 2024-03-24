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

hasBME280=False
try:
  import smbus
  hasBME280=True
except:
  pass

from avnav_nmea import *
from avnav_worker import *
import avnav_handlerList


def getShort(data, index):
  # return two bytes from data as a signed 16-bit value
  return c_short((data[index+1] << 8) + data[index]).value

def getUShort(data, index):
  # return two bytes from data as an unsigned 16-bit value
  return (data[index+1] << 8) + data[index]

def getChar(data,index):
  # return one byte from data as a signed char
  result = data[index]
  if result > 127:
    result -= 256
  return result

def getUChar(data,index):
  # return one byte from data as an unsigned char
  result =  data[index] & 0xFF
  return result

def readBME280ID(bus,addr):
  if bus is None:
    return (0,0)
  # Chip ID Register Address
  REG_ID     = 0xD0
  (chip_id, chip_version) = bus.read_i2c_block_data(addr, REG_ID, 2)
  return (chip_id, chip_version)

def readBME280All(bus,addr):
  if bus is None:
    return (1,2,3)
  # Register Addresses
  REG_DATA = 0xF7
  REG_CONTROL = 0xF4
  REG_CONFIG  = 0xF5

  REG_CONTROL_HUM = 0xF2
  REG_HUM_MSB = 0xFD
  REG_HUM_LSB = 0xFE

  # Oversample setting - page 27
  OVERSAMPLE_TEMP = 2
  OVERSAMPLE_PRES = 2
  MODE = 1

  # Oversample setting for humidity register - page 26
  OVERSAMPLE_HUM = 2
  bus.write_byte_data(addr, REG_CONTROL_HUM, OVERSAMPLE_HUM)

  control = OVERSAMPLE_TEMP<<5 | OVERSAMPLE_PRES<<2 | MODE
  bus.write_byte_data(addr, REG_CONTROL, control)

  # Read blocks of calibration data from EEPROM
  # See Page 22 data sheet
  cal1 = bus.read_i2c_block_data(addr, 0x88, 24)
  cal2 = bus.read_i2c_block_data(addr, 0xA1, 1)
  cal3 = bus.read_i2c_block_data(addr, 0xE1, 7)

  # Convert byte data to word values
  dig_T1 = getUShort(cal1, 0)
  dig_T2 = getShort(cal1, 2)
  dig_T3 = getShort(cal1, 4)

  dig_P1 = getUShort(cal1, 6)
  dig_P2 = getShort(cal1, 8)
  dig_P3 = getShort(cal1, 10)
  dig_P4 = getShort(cal1, 12)
  dig_P5 = getShort(cal1, 14)
  dig_P6 = getShort(cal1, 16)
  dig_P7 = getShort(cal1, 18)
  dig_P8 = getShort(cal1, 20)
  dig_P9 = getShort(cal1, 22)

  dig_H1 = getUChar(cal2, 0)
  dig_H2 = getShort(cal3, 0)
  dig_H3 = getUChar(cal3, 2)

  dig_H4 = getChar(cal3, 3)
  dig_H4 = (dig_H4 << 24) >> 20
  dig_H4 = dig_H4 | (getChar(cal3, 4) & 0x0F)

  dig_H5 = getChar(cal3, 5)
  dig_H5 = (dig_H5 << 24) >> 20
  dig_H5 = dig_H5 | (getUChar(cal3, 4) >> 4 & 0x0F)

  dig_H6 = getChar(cal3, 6)

  # Wait in ms (Datasheet Appendix B: Measurement time and current calculation)
  wait_time = 1.25 + (2.3 * OVERSAMPLE_TEMP) + ((2.3 * OVERSAMPLE_PRES) + 0.575) + ((2.3 * OVERSAMPLE_HUM)+0.575)
  time.sleep(wait_time/1000)  # Wait the required time

  # Read temperature/pressure/humidity
  data = bus.read_i2c_block_data(addr, REG_DATA, 8)
  pres_raw = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
  temp_raw = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
  hum_raw = (data[6] << 8) | data[7]

  #Refine temperature
  var1 = ((((temp_raw>>3)-(dig_T1<<1)))*(dig_T2)) >> 11
  var2 = (((((temp_raw>>4) - (dig_T1)) * ((temp_raw>>4) - (dig_T1))) >> 12) * (dig_T3)) >> 14
  t_fine = var1+var2
  temperature = float(((t_fine * 5) + 128) >> 8);

  # Refine pressure and adjust for temperature
  var1 = t_fine / 2.0 - 64000.0
  var2 = var1 * var1 * dig_P6 / 32768.0
  var2 = var2 + var1 * dig_P5 * 2.0
  var2 = var2 / 4.0 + dig_P4 * 65536.0
  var1 = (dig_P3 * var1 * var1 / 524288.0 + dig_P2 * var1) / 524288.0
  var1 = (1.0 + var1 / 32768.0) * dig_P1
  if var1 == 0:
    pressure=0
  else:
    pressure = 1048576.0 - pres_raw
    pressure = ((pressure - var2 / 4096.0) * 6250.0) / var1
    var1 = dig_P9 * pressure * pressure / 2147483648.0
    var2 = pressure * dig_P8 / 32768.0
    pressure = pressure + (var1 + var2 + dig_P7) / 16.0

  # Refine humidity
  humidity = t_fine - 76800.0
  humidity = (hum_raw - (dig_H4 * 64.0 + dig_H5 / 16384.0 * humidity)) * (dig_H2 / 65536.0 * (1.0 + dig_H6 / 67108864.0 * humidity * (1.0 + dig_H3 / 67108864.0 * humidity)))
  humidity = humidity * (1.0 - dig_H1 * humidity / 524288.0)
  if humidity > 100:
    humidity = 100
  elif humidity < 0:
    humidity = 0

  return temperature/100.0,pressure/100.0,humidity

class ParamHex(WorkerParameter):
  def __init__(self, name,default, **kwargs):
    super().__init__(name,default,**kwargs)
    self.type=self.T_STRING

  def _getValue(self, val):
    return int(str(val),16)


class AVNBME280Reader(AVNWorker):
  """ a worker to read data from the BME280 module
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
  P_NAMEPRESS=WorkerParameter('namePress','Barometer',
                              description="XDR transducer name for pressure")
  P_NAMEHUMID=WorkerParameter('nameHumid','Humidity',
                              description="XDR transducer name for humidity")
  P_NAMETEMP=WorkerParameter('nameTemp', 'TempAir',
                             description="XDR transducer name for temperature")
  P_ADDR=ParamHex('addr' ,'0x77',
                         description='I2C address for the BME in 0xnn notation')
  @classmethod
  def getConfigName(cls):
    return "AVNBME280Reader"

  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = [
      cls.PRIORITY_PARAM_DESCRIPTION,
      cls.P_INTERVAL,
      cls.P_WRITEMDA,
      cls.P_WRITEXDR,
      cls.P_NAMEPRESS,
      cls.P_NAMEHUMID,
      cls.P_NAMETEMP,
      cls.P_ADDR
    ]
    return rt

  @classmethod
  def canEdit(cls):
    return hasBME280

  @classmethod
  def canDeleteHandler(cls):
    return hasBME280

  @classmethod
  def canDisable(cls):
    return True

  def isDisabled(self):
    if not hasBME280:
      return True
    return super().isDisabled()



  # thread run method - just try forever
  def run(self):
    bus=None
    if hasBME280:
      try:
        # BME280DEVICE = 0x77 # Default device I2C Address
        bus = smbus.SMBus(1)  # Rev 2 Pi, Pi 2 & Pi 3 uses bus 1
      except Exception as e:
        raise Exception("unable to get smbus #1: %s" % str(e))
    else:
      raise Exception("smbus library not installed")
    self.setInfo('main', "reading BME280", WorkerStatus.NMEA)
    while True:
      addr = self.getWParam(self.P_ADDR)
      priority=self.getWParam(self.PRIORITY_PARAM_DESCRIPTION)
      (chip_id, chip_version) = readBME280ID(bus,addr)
      info = "Using BME280 Chip: %d Version: %d" % (chip_id, chip_version)
      AVNLog.info(info)
      self.setInfo('main', "reading BME280 id=%d, version=%d"%(chip_id,chip_version), WorkerStatus.NMEA)
      source = self.getSourceName(addr)
      try:
        temperature,pressure,humidity = readBME280All(bus,addr)
        if self.getWParam(self.P_WRITEMDA):
          """$AVMDA,,,1.00000,B,,,,,,,,,,,,,,,,"""
          mda = '$AVMDA,,,%.5f,B,,,,,,,,,,,,,,,,' % ( pressure / 1000.)
          AVNLog.debug("BME280:MDA %s", mda)
          self.queue.addNMEA(mda,source,addCheckSum=True,sourcePriority=priority)
          """$AVMTA,19.50,C*2B"""
          mta = '$AVMTA,%.2f,C' % (temperature)
          AVNLog.debug("BME280:MTA %s", mta)
          self.queue.addNMEA(mta,source,addCheckSum=True,sourcePriority=priority)
        if self.getWParam(self.P_WRITEXDR):
          tn=self.getWParam(self.P_NAMEPRESS)
          xdr = '$AVXDR,P,%.5f,B,%s' % (pressure / 1000.,tn)
          AVNLog.debug("BME280:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.getWParam(self.P_NAMETEMP)
          xdr = '$AVXDR,C,%.2f,C,%s' % (temperature,tn)
          AVNLog.debug("BME280:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.getWParam(self.P_NAMEHUMID)
          xdr = '$AVXDR,H,%.2f,P,%s' % (humidity,tn)
          AVNLog.debug("BME280:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)

      except:
        AVNLog.info("exception while reading data from BME280 %s" ,traceback.format_exc())
      wt = self.getWParam(self.P_INTERVAL)
      if not wt or wt < 0.5:
        wt = 5.0
      self.wait(wt)


avnav_handlerList.registerHandler(AVNBME280Reader)
