import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'

export class IcpQuery extends plugin {
  constructor () {
    super({
      name: 'ICP备案查询',
      dsc: '查询网站ICP备案信息',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: /^#?icp查询\s?.+$/i,
          fnc: 'queryIcp'
        }
      ]
    })
  }

  async queryIcp () {
    const domain = this.e.msg.replace(/^#?icp查询\s?/i, '').trim()
    if (!domain) {
      await this.reply('请输入要查询的域名')
      return
    }

    try {
      const apiUrl = `https://api.suol.cc/v1/icp.php?url=${encodeURIComponent(domain)}`
      const response = await fetch(apiUrl)
      const data = await response.json()

      if (data.code !== 200 || !data.icp) {
        await this.reply('查询失败，请检查域名是否正确或稍后再试')
        return
      }

      const forwardMsg = []
      
      forwardMsg.push({
        user_id: this.e.bot.uin,
        nickname: 'ICP备案查询',
        message: `域名: ${data.url}`
      })

      for (const [key, value] of Object.entries(data.icp)) {
        forwardMsg.push({
          user_id: this.e.bot.uin,
          nickname: 'ICP备案查询',
          message: `${key}: ${value}`
        })
      }

      let ngm
      if (this.e.isGroup) {
        ngm = await this.e.group.makeForwardMsg(forwardMsg)
      } else {
        ngm = await this.e.friend.makeForwardMsg(forwardMsg)
      }

      if (typeof ngm.data === 'object') {
        let detail = ngm.data?.meta?.detail
        if (detail) {
          detail.news = [{ text: 'ICP查询结果' }]
          detail.source = 'ICP备案查询'
          detail.summary = 'ICP查询'
          detail.preview = ''
        }
        if (ngm.data?.prompt) {
          ngm.data.prompt = 'ICP查询结果'
        }
      }

      await this.reply(ngm)

    } catch (error) {
      console.error('ICP查询出错:', error)
      await this.reply('查询出错，请稍后再试')
    }
  }
}