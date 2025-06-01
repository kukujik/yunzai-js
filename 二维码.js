import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'

export class QRCodeGenerator extends plugin {
  constructor() {
    super({
      name: '二维码生成',
      dsc: '生成二维码图片',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: '^#二维码(.+)$',
          fnc: 'generateQRCode'
        }
      ]
    })
  }

  async generateQRCode() {
    const content = this.e.msg.replace(/^#二维码/, '').trim()
    
    if (!content) {
      await this.reply('请输入要生成二维码的内容', true)
      return
    }

    try {
      const apiUrl = `https://api.2dcode.biz/v1/create-qr-code?data=${encodeURIComponent(content)}`
      await this.reply(segment.image(apiUrl), true)

    } catch (error) {
      console.error('二维码生成出错:', error)
      await this.reply('生成二维码失败，请稍后再试', true)
    }
  }
}