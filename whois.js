import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import punycode from 'punycode'

export class WhoisQuery extends plugin {
  constructor() {
    super({
      name: 'WHOIS查询',
      dsc: '查询域名WHOIS信息',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: '^#?(whois|WHOIS)查询(\\s+|)(.+)$',
          fnc: 'queryWhois'
        }
      ]
    })
  }

  async queryWhois() {
    let originalDomain = this.e.msg.replace(/^#?(whois|WHOIS)查询\s*/i, '').trim()
    if (!originalDomain) {
      await this.reply('请输入要查询的域名')
      return
    }

    let queryDomain = originalDomain
    if (/[\u4e00-\u9fa5]/.test(originalDomain)) {
      queryDomain = punycode.toASCII(originalDomain)
    }

    try {
      const apiUrl = `https://v2.xxapi.cn/api/whois?domain=${encodeURIComponent(queryDomain)}`
      const response = await fetch(apiUrl)
      const data = await response.json()

      if (data.code !== 200 || !data.data) {
        await this.reply('查询失败，请检查域名是否正确或稍后再试')
        return
      }

      const forwardMsg = []

      forwardMsg.push({
        user_id: this.e.bot.uin,
        nickname: 'WHOIS查询结果',
        message: `域名: ${originalDomain}`
      })

      const allFields = [
        { name: '注册人', key: 'Registrant' },
        { name: '注册人邮箱', key: 'Registrant Contact Email' },
        { name: '注册商', key: 'Sponsoring Registrar' },
        { name: '注册商URL', key: 'Registrar URL' },
        { name: '注册时间', key: 'Registration Time' },
        { name: '过期时间', key: 'Expiration Time' },
        { name: '域名状态', key: 'domain_status' },
        { name: 'DNS服务器', key: 'DNS Serve' }
      ]

      for (const field of allFields) {
        let value = data.data[field.key] || data.data.data?.[field.key.toLowerCase()] || '无信息'
        
        if (Array.isArray(value)) {
          value = value.join('\n')
        }
        
        if (!value || value === '无信息') {
          value = '未公开'
        }

        forwardMsg.push({
          user_id: this.e.bot.uin,
          nickname: 'WHOIS查询结果',
          message: `${field.name}: ${value}`
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
          detail.news = [{ text: 'WHOIS查询结果' }]
          detail.source = 'WHOIS查询'
          detail.summary = 'WHOIS查询'
          detail.preview = ''
        }
        if (ngm.data?.prompt) {
          ngm.data.prompt = 'WHOIS查询结果'
        }
      }

      await this.reply(ngm)

    } catch (error) {
      console.error('WHOIS查询出错:', error)
      await this.reply('查询出错，请稍后再试')
    }
  }
}