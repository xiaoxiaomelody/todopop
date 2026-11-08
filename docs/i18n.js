/* todopop.app in English and Chinese. English is what's written in index.html; this holds the Chinese,
   swaps it in and out, and gives the other scripts T() for the words they write themselves. */
(() => {
  const LOGO = 'T<span class="o"></span>D<span class="o"></span>P<span class="o"></span>P';
  const CZ = '<a class="md cz" href="https://cindyzhao.design" target="_blank" rel="noopener">Cindy Zhao</a>';

  // [selector, Chinese HTML (or a list, one per match)]
  const PAGE = [
    ['.nav a[href="how.html"]', '怎么用'],
    ['.nav a[href="phone.html"]', '手机'],
    ['#key-title', '核心功能'],
    ['.nav a.get', '下载'],
    ['#hero-title', 'TODOPOP：一个让你没有借口拖延的待办清单'],
    ['.o-notes .hint > span', '*点点看<br><span style="white-space:nowrap">logo 上的三个 O！</span>'],
    ['.o-note .tx', ['新建任务', '查看进度', '个性化']],
    ['.tagline', '一个让你没有借口拖延的待办清单'],
    ['#hero-btns [data-os="mac"] .tx', '下载 Mac 版'],
    ['#hero-btns [data-os="win"] .tx', '下载 Windows 版'],
    ['#hero-meta', '免费 · 无需注册 · 无广告'],
    ['.bubble-hint > b', '*与这些任务泡泡交互'],
    ['.bubble-hint li', ['可<b>拖拽</b>', '<b>右键</b>编辑', '<b>单击</b>进入专注模式', '<b>长按</b>戳破 标记完成']],

    ['.eyebrow', '<span>痛点</span> TODOPOP 想解决的问题'],
    ['#story-title', `<span class="bk">(</span>${CZ}<span class="bk">)</span> 的作品`],
    ['.collab', '*与 <span class="bk">(</span><a class="md cz" href="https://www.linkedin.com/in/xiaoxiaomelody/" target="_blank" rel="noopener">Melody Chen</a><span class="bk">)</span><br>合作完成'],
    ['.who .tx', '她：'],
    ['#why1', '<span><span class="ph">看不见一个待办，</span><br><span class="ph">她就会忘记。</span></span>'],
    ['#why2', '<span><span class="ph">昨天的 deadline 了，</span><br><span class="ph">她甚至今天还没开始。</span></span>'],
    ['#why3', '<span><span class="ph">明日复明日，</span><br><span class="ph">她的字典里就没有今天。</span></span>'],
    ['#solves', '为了解决这些问题<br>我创建了 <span class="md">TODOPOP</span>：'],
    ['.feat h3', ['永远浮在最上层', '随时间长大', '绝不清空任务']],
    ['.feat .card > p', ['<span class="ph">一直浮在你正在用的窗口上方</span><br><span class="ph">不会藏在关掉的软件里</span>',
      '<span class="ph">截止日期越近 泡泡越大</span><br><span class="ph">温柔地制造视觉压力</span>',
      '<span class="ph">没戳破的泡泡会一直留在屏幕上</span><br><span class="ph">没有“过了午夜就清零”这种借口</span>']],
    ['#feat1 .fb', ['数学作业<small>马上！</small>', '回邮件<small>今天</small>', '洗衣服<small>快了</small>']],

    ['#q-title', 'Cindy，Cindy，<br>可是我要开始专心学习了<br>任务泡泡们却已经霸占了整个屏幕呢？'],
    ['#focus .a .tx', '点这里'],
    ['#get-in', '钻进泡泡'],
    ['#screen .scr-win .bar', '<i></i><i></i><i></i>&nbsp;论文草稿 — Docs'],
    ['#screen .scr-bar em', '论文草稿'],
    ['#scr-step', '+ 步骤'],
    ['#scr-done', '完成，戳破！'],
    ['#focus .body p', ['<b>单击泡泡，进入专注模式。</b>所有的任务泡泡都会消失在屏幕上，专注计时器开启，你还可以把大项目拆成一个个好消化的小步骤。',
      '我的初衷是这样故意给你带来不便的设计，能够打断拖延循环，倒逼你关掉所有多余的标签页。求求你了，开始学吧。']],

    ['#more-title', '更多功能'],
    ['.feats li span', ['颜色分组', '贴到屏幕边缘', '附加链接', '暂停生长', '恢复初始大小']],
    ['.pill.over', '手机可远程操控'],
    ['.remote .lead', '<span class="ph">电脑不在身边</span><br><span class="ph">但是突然想起了待办事项？</span>'],
    ['.remote p:not(.lead)', '把任务清单随时带在身边，用手机添加新任务。<br>回家打开电脑，新任务已经飘在你的屏幕上了。'],
    ['.tut h3', '安装 + 配对教程：'],
    ['.tut .btns a', ['在 iPhone 上使用', '下载安卓版 <small>.apk</small>']],
    ['.tut li:nth-child(2) > span:last-child', '在电脑上打开 TODOPOP，点第三个 O，再点 <b>[获取手机 App]</b>，屏幕上就会出现一个二维码'],
    ['.tut li:nth-child(3) > span:last-child', '在手机上打开 TODOPOP，点 <b>[扫码]</b>，对准电脑屏幕扫一下。'],
    ['.tut li:nth-child(4) > span:last-child', '第二台电脑？在第一台电脑上点第三个 O → <b>[再显示一次二维码]</b> → <b>[复制链接]</b>。然后在第二台电脑上点第三个 O → <b>[加入另一台电脑的清单]</b>，粘贴进去。任务两边同步，泡泡各自摆放。'],
    ['.tut .fine', '*配对不需要注册账号，也不用留邮箱或手机号。想知道是怎么做到的，请看“怎么用”页面里的 <a href="how.html#privacy"><b>[隐私]</b></a> 部分'],

    ['#dl-title', `获取 <span class="logo" aria-label="TODOPOP">${LOGO}</span>`],
    ['.dl .btns a', ['下载 Windows 版 <small>.exe</small>', '下载 Mac 版 <small>.dmg</small>']],
    ['.dl .meta', 'Windows 10 和 11（64 位）· macOS · <a href="https://github.com/nosugarlessice/todopop/releases">所有版本</a>'],
    ['.first .cap', '第一次打开时'],
    ['.first details', [
      `<summary>Windows 提示“Windows 已保护你的电脑”</summary><ol>
        <li>这是因为 TODOPOP 还很新，还没有微软的签名。你下载的文件没有任何问题。</li>
        <li>点<b>更多信息</b>，再点<b>仍要运行</b>，TODOPOP 就会安装并打开。</li>
        <li>这个提示只会出现一次。</li></ol>`,
      `<summary>Mac 提示 TODOPOP “无法打开”或“Apple 无法验证”</summary><ol>
        <li>打开下载好的 <b>TODOPOP-mac.dmg</b>，把 <b>TODOPOP</b> 拖进<b>应用程序</b>。</li>
        <li>从“应用程序”里打开 TODOPOP。如果 macOS 拦住了它，点<b>完成</b>。</li>
        <li>打开<b>系统设置 → 隐私与安全性</b>，往下滚，点 TODOPOP 旁边的<b>仍要打开</b>，再输入密码确认。</li>
        <li>TODOPOP 住在屏幕顶部的菜单栏里，不在程序坞里。这一步只需要做一次。</li></ol>`,
      `<summary>安卓在安装 TODOPOP 前会先问你</summary><ol>
        <li>从通知栏或<b>下载</b>里打开下载好的 <b>TODOPOP-android.apk</b>。</li>
        <li>如果安卓说你的浏览器不能安装应用，点<b>设置</b>，打开<b>允许来自此来源的应用</b>，再返回。</li>
        <li>点<b>安装</b>。如果 Play 保护机制提示这是未知应用，点<b>更多详情 → 仍然安装</b>。它还很新，Google 还没见过它。</li></ol>`]],

    ['#priv-title', '隐私'],
    ['.priv-head > span', '你的清单只属于你。'],
    ['.priv > div', [
      '<h3>无需账号</h3><p>不用注册，不用邮箱，不用密码。<br>打开 App 就能开始吹泡泡。</p>',
      '<h3>只留在你的电脑上</h3><p>你的任务永远不会离开你的电脑。</p>',
      '<h3>私密同步</h3><p>连上手机后，清单通过 Supabase 同步，锁在一个只有你自己的设备才知道的私密代码上。本产品和本网站没有广告，也没有任何追踪。</p>']],

    ['footer nav a', ['下载', '怎么用', '手机 App']],
    ['#fb-done', '完成，戳破！'],
  ];
  const ATTRS = [ // [selector, attribute, Chinese]
    ['#device img', 'src', 'phone-app-zh.png'],
    ['#device img', 'alt', 'TODOPOP 手机 App：漂浮中的任务排成一个列表，底部是暂停、一个大加号和已戳破。'],
    ['#fb-exit', 'aria-label', '离开泡泡（Esc）'], ['#fb-exit', 'title', '离开泡泡（Esc）'],
    ['#focus-bar .grip', 'title', '拖动来移动这个栏'],
    ['.big .o[data-o="0"]', 'aria-label', '新建任务'], ['.big .o[data-o="1"]', 'aria-label', '查看进度'], ['.big .o[data-o="2"]', 'aria-label', '个性化'],
    ['.navlogo', 'aria-label', 'TODOPOP，回到顶部'], ['#foot-logo', 'aria-label', 'TODOPOP，重新开始'],
  ];

  // words the scripts write themselves
  const WORDS = {
    'Get the Android app': '下载安卓 App', 'Get on iPhone': '在 iPhone 上使用',
    'Free · No Sign-up · No ads · The bubbles float on your computer; your phone is the remote.': '免费 · 无需注册 · 无广告 · 泡泡飘在你的电脑上，手机就是遥控器。',
    'REMIND': '提醒', 'SOON': '快了', 'TODAY': '今天', 'NOW!': '马上！',
    'Just a reminder': '只是提醒', 'Soon': '快了', 'Today': '今天', 'Super urgent': '超级紧急',
    'School': '学校', 'Work': '工作', 'Home': '家', 'Health': '健康', 'No group': '不分组',
    'Blow a bubble': '吹一个泡泡', 'Task name': '任务名称', 'e.g. Send the team the Figma link': '比如：把 Figma 链接发给组员',
    'Urgency': '紧急程度', 'Group': '分组', 'Blow it': '吹出来', 'Close': '关闭',
    'Popped': '已戳破', 'Week': '周', 'Month': '月', 'Earlier': '往前', 'Later': '往后', 'View': '视图',
    'Nothing popped on this page yet. Press and hold a bubble to pop it, and it lands in today.': '这一页还没有戳破任何泡泡。长按一个泡泡把它戳破，它就会出现在今天。',
    'Days before today are a sample history, to show what a few weeks of popping looks like.': '今天之前的记录是示例，让你看看用上几周之后是什么样子。',
    'Your color': '你的颜色',
    'The whole page and every bubble follow your color. In the app you can pick any color at all, and your groups’ colors shift to match it.': '整个页面和每个泡泡都会跟着你的颜色变。在 App 里你可以选任何颜色，分组的颜色也会跟着调整。',
    'Edit bubble': '编辑泡泡', 'Get in the bubble': '钻进泡泡', 'Delete': '删除', 'Cancel': '取消', 'Save': '保存', 'Shrink back to starting size': '缩回初始大小',
    'Essay draft': '论文草稿', 'Reply to emails': '回邮件', 'Laundry': '洗衣服', 'Read ch. 7': '读第 7 章',
    'Outline': '列提纲', 'Find 3 sources': '找 3 篇文献', 'Draft intro': '写开头',
    // the floating bubbles, and the sample history
    'Problem set 4': '数学作业', 'Figma critique': '改设计稿', 'Water the pothos': '给绿萝浇水', 'Book dentist': '约牙医',
    'Portfolio review': '作品集评审', 'Call mom': '给妈妈打电话', 'Drink water': '喝水', 'Pay rent': '交房租', 'Gym': '去健身',
    'Email the landlord': '给房东发邮件', 'Groceries': '买菜', 'Return library books': '还图书馆的书', 'Taxes': '报税',
    'Problem set 3': '物理作业', 'Reading response': '阅读反馈', 'Email TA': '给助教发邮件', 'Studio crit prep': '准备课堂汇报', 'Print posters': '打印海报',
    'Send invoice': '发账单', 'Update portfolio': '更新作品集', 'Clean desk': '收拾桌面', 'Return library book': '还图书馆的书',
  };

  let lang = 'en';
  const saved = (() => { try{ return localStorage.getItem('tp-lang'); }catch(e){ return null; } })();
  const want = /[?&]lang=zh/.test(location.search) ? 'zh' : /[?&]lang=en/.test(location.search) ? 'en'
    : saved || (/^zh\b/i.test(navigator.language || '') ? 'zh' : 'en');

  const T = s => lang === 'zh' && WORDS[s] != null ? WORDS[s] : s;
  const listeners = [];
  function apply(l){
    lang = l === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    for(const [sel, zh] of PAGE){
      document.querySelectorAll(sel).forEach((el, i) => {
        if(el.dataset.en == null) el.dataset.en = el.innerHTML;
        const z = Array.isArray(zh) ? zh[i] : zh; if(z == null) return;
        el.innerHTML = lang === 'zh' ? z : el.dataset.en;
      });
    }
    for(const [sel, attr, zh] of ATTRS){
      document.querySelectorAll(sel).forEach(el => { const k = 'en' + attr.replace(/[^a-z]/gi, ''); if(el.dataset[k] == null) el.dataset[k] = el.getAttribute(attr) || ''; el.setAttribute(attr, lang === 'zh' ? zh : el.dataset[k]); });
    }
    document.title = lang === 'zh' ? 'TODOPOP · 一个让你没有借口拖延的待办清单' : 'TODOPOP · A todo list that just can’t be ignored';
    listeners.forEach(f => f(lang));
  }
  window.I18N = { T, get lang(){ return lang; }, onChange: f => listeners.push(f),
    set(l){ try{ localStorage.setItem('tp-lang', l); }catch(e){} apply(l); } };

  // the page is parsed by the time this runs (it's at the end of <body>)
  if(want === 'zh') apply('zh'); else document.documentElement.lang = 'en';
  document.getElementById('lang')?.addEventListener('click', () => window.I18N.set(lang === 'zh' ? 'en' : 'zh'));
})();
// TODOPOP: touched 2026-11-08
