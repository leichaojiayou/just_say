var http = require('../../../service/request.js'),
    dealErr = require('../../../util/err_deal.js'),
    util = require('../../../util/util.js'),
    app = getApp()
var playTimeInterval
var recordTimeInterval
var updateInterval
var recordTimeout
var updateTimeout
Page({
  data: {
    li: 0,
    loop: false,    // 循环
    playing: false,
    currentTag: 'a',
    stop: false,
    playTime: '00:00:00',
    mao: 0,

    once: true,
    recording: false,
    recordPlaying: false,
    hasRecord: false,
    recordTime: 0,
    recordPlayTime: 0,
    active: false, //主动停止录音
  },
  goHash (e) {
      let hash = e.currentTarget.dataset.hash
      console.log(hash)
      this.setData({
          mao: hash
      })
  },
  doubleClick: function (e) {
    var that = this
    //触摸时间距离页面打开时间毫秒数
    var curTime = e.timeStamp
    //上一次触摸距离页面打开时间毫秒数
    var lastTime = this.data.lastTapDiffTime

    if(lastTime > 0) {
      //如果两次单击间隔小于300毫秒，认为是双击
      if(curTime - lastTime < 300) {
        //双击
        if(that.data.currentTag == e.currentTarget.dataset.id) {
          that.setData({
            loop: false,
            currentTag: 'a'
          })
        } else if(that.data.li == e.currentTarget.dataset.id) {
          that.setData({
            loop: true,
            li: parseInt(e.currentTarget.dataset.id),
            currentTag: e.currentTarget.dataset.id
          })
        } else {
          clearInterval(recordTimeInterval)
          clearInterval(playTimeInterval)
          clearInterval(updateInterval)
          clearTimeout(recordTimeout)
          clearTimeout(updateTimeout)

          that.setData({
            loop: true,
            li: parseInt(e.currentTarget.dataset.id),
            currentTag: e.currentTarget.dataset.id
          })
          that.play()
          that.afterStop()
        }
      } else {
        console.log(e.timeStamp + '- tap')
      }
    } else {
      console.log(e.timeStamp + '- first tap')
    }

    this.setData({
      lastTapDiffTime: curTime
    })
  },
  play: function (res) {
    var that = this
    
    wx.playBackgroundAudio({
      dataUrl: that.data.arr[that.data.li].mp3,
      complete: function (res) {
        that.setData({
          playing: true
        })
        that._enableInterval()
      }
    })
    app.globalData.backgroundAudioPlaying = true
  },
  // seek: function (e) {
  //   clearInterval(this.updateInterval)
  //   var that = this
  //   wx.seekBackgroundAudio({
  //     position: e.detail.value,
  //     complete: function () {
  //       // 实际会延迟两秒左右才跳过去
  //       setTimeout(function () {
  //         that._enableInterval()
  //       }, 2000)
  //     }
  //   })
  // },
  pause: function () {
    var that = this
    //暂停播放
    wx.pauseBackgroundAudio()

    that.setData({
      playing: false
    })

    app.globalData.backgroundAudioPlaying = false
  },
  afterStop: function() {
    var that = this

    clearInterval(updateInterval)
    clearTimeout(updateTimeout)
    
    wx.onBackgroundAudioStop(function() {
      app.globalData.backgroundAudioPlaying = false
      //开始录音
      that.startRecord()
      //停止录音
      recordTimeout = setTimeout(function() {
        that.stopRecord()
      }, that.data.duration*1000)
        
    })
  },
  _enableInterval: function () {
    var that = this
    update()
    if(!that.data.stop) {
      updateInterval = setInterval(update, 500)
    } else {
      clearInterval(updateInterval)
    }
    function update() {
      wx.getBackgroundAudioPlayerState({
        success: function (res) {
          console.log(res.currentPosition)
          console.log(res.duration)
          if(that.data.stop) {
            //已经退出页面，停止当前的播放
            that.setData({
              stop: true
            })
          }
          if(res.duration) {
            that.setData({
              duration: res.duration + 3
            })
          }
          if(that.data.playing) {
            that.setData({
              playTime: util.formatTime(res.currentPosition)
            })
          }
        }
      })
    }
  },
  getCourse: function() {
    var that = this
    var url = that.data.url + 'hh' + that.data.num + '.json',
        data = {}

    http._get(url, data,
      function(res) {
        dealErr.dealErr(res, function() {
          for(var x = 0; x < res.data.length; x++)
            res.data[x].index = x

          that.setData({
            arr: res.data,
            max: res.data.length
          })
          that.play()
          that.afterStop()    //包含播放结束的回调方法
        })
      }, function(res) {
        dealErr.fail()
      })
  },
  startRecord: function () {
    var that = this
          
    that.setData({
      playing: false,
      playTime: util.formatTime(0),
      recording: true
    })

    recordTimeInterval = setInterval(function () {
      var recordTime = that.data.recordTime += 1
      that.setData({
        playTime: util.formatTime(that.data.recordTime),
        recordTime: recordTime
      })
    }, 1000)

    wx.startRecord({
      success: function (res) {
        console.log('record success')
        clearInterval(recordTimeInterval)
        clearTimeout(recordTimeout)

        that.setData({
          recording: false,
          hasRecord: true,
          recordTime: 0,
          tempFilePath: res.tempFilePath,
          playTime: util.formatTime(0)
        })
        //主动停止录音，不播放录音
        if(!that.data.active) {
          //播放录音
          that.playVoice()
        } else {
          that.setData({
            active: false
          })
        }
      }
    })
  },
  stopRecord: function(e) {
    if(e) {
      this.setData({
        active: true
      })
    }
    //停止录音，结束到时停止录音callback
    clearTimeout(recordTimeout)
    clearInterval(recordTimeInterval)

    wx.stopRecord()
  },
  stopRecordUnexpectedly: function () {
    var that = this
    wx.stopRecord()

    clearInterval(recordTimeInterval)

    that.setData({
      recording: false,
      hasRecord: false,
      recordTime: 0,
      playTime: util.formatTime(0)
    })
  },
  playVoice: function () {
    var that = this

    that.setData({
      recordPlaying: true
    })

    playTimeInterval = setInterval(function () {
      var recordPlayTime = that.data.recordPlayTime + 1
      console.log('update recordPlayTime', recordPlayTime)
      that.setData({
        playTime: util.formatTime(recordPlayTime),
        recordPlayTime: recordPlayTime
      })
    }, 1000)

    wx.playVoice({
      filePath: that.data.tempFilePath,
      success: function () {
        clearInterval(playTimeInterval)
        var playTime = 0
        that.setData({
          recordPlaying: false,
          playTime: util.formatTime(playTime)
        })
        
        that.clear()
        that.checkLoop()
      }
    })
  },
  pauseVoice: function () {
    clearInterval(playTimeInterval)

    wx.pauseVoice()

    this.setData({
      recordPlaying: false
    })
  },
  stopVoice: function () {
    var that = this
    clearInterval(playTimeInterval)

    this.setData({
      recordPlaying: false,
      playTime: util.formatTime(0),
      recordPlayTime: 0
    })

    wx.stopVoice()

    that.clear()
    that.checkLoop  ()    
  },
  checkLoop: function() {
    var that = this
    if(that.data.loop || that.data.once) {
      that.setData({
        once: false
      })
    } else {
      that.setData({
        li: that.data.li + 1,
        once: true
      })
    }

    if(that.data.li == that.data.max) {
      app.gloable.studyProgramOfRepeat = that.data.num
    } else if(that.data.stop) {
      
    } else {
      updateTimeout = setTimeout(function(){
        that.play()
        that.afterStop()
      }, 2000)
    }
  },
  clear: function () {
    clearInterval(playTimeInterval)
    clearInterval(recordTimeInterval)
    wx.stopRecord()
    this.setData({
      recordPlaying: false,
      hasRecord: false,
      tempFilePath: '',
      playTime: util.formatTime(0),
      recordTime: 0,
      recordPlayTime: 0
    })
  },
  onLoad:function(options){
    // 页面初始化 options为页面跳转所带来的参数
    var that = this

    wx.getSystemInfo( {
      success: ( res ) => {
        this.setData( {
          windowHeight: res.windowHeight - 140,
          windowWidth: res.windowWidth
        })
      }
    })

    that.audioCtx = wx.createAudioContext('myAudio')
    var api = app.globalData.APIUrl,
        url = app.globalData.url

    that.setData({
      api: api,
      url: url,
      num: options.index
    })

    that.getCourse()

    if (app.globalData.backgroundAudioPlaying) {
      this.setData({
        playing: true
      })
    }
  },
  onReady:function(){
    // 页面渲染完成
  },
  onShow:function(){
    // 页面显示
    this.setData({
      stop: false
    })
  },
  onHide:function(){
    // 页面隐藏
    if (this.data.playing) {
      this.stopVoice()
    } else if (this.data.recording) {
      this.stopRecordUnexpectedly()
    }

    this.setData({
      stop: true
    })
    clearTimeout(updateTimeout)
    clearInterval(updateInterval)
  },
  onUnload:function(){
    // 页面关闭
    if (this.data.playing) {
      this.stopVoice()
    } else if (this.data.recording) {
      this.stopRecordUnexpectedly()
    }

    this.setData({
      stop: true
    })
    clearTimeout(updateTimeout)
    clearInterval(updateInterval)
  }
})