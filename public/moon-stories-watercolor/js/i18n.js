/* Poetic multi-language support for Moon Stories Watercolor (en, vi, zh-CN, es, ja). */
(() => {
  'use strict';

  const ENGLISH_BASE = globalThis.MoonStoryData.map((s) => ({
    image: s.image,
    src: s.src,
    scene: s.scene,
    description: s.description,
    captions: s.captions.map((c) => ({ speaker: c.speaker, text: c.text })),
    direction: s.direction,
  }));

  const LOCALES = {
    vi: {
      docTitle: 'Tìm Thấy Bạn Giữa Ngân Hà · Tranh Màu Nước Cung Trăng',
      metaDesc: 'Cội rễ giữ điều xưa; ước mơ chắp cánh bay xa. Câu chuyện cổ tích màu nước qua 22 bức tranh vẽ tay.',
      skip: 'Đọc toàn văn câu chuyện',
      brand: 'Cung Trăng Màu Nước',
      openingEyebrow: 'CHUYỆN KỂ VƯỢT MUÔN VÌ SAO',
      titleLine1: 'CỘI RỄ',
      titleLine2: 'GIỮA NGÂN HÀ',
      tagline: 'Rễ xưa níu đất cội nguồn, ước mơ chắp cánh bay muôn dặm trời.',
      beginBtn: 'Khởi hành khám phá',
      assetError: 'Chưa thể tải bức tranh này. Bạn vẫn có thể đọc trọn vẹn câu chuyện bên dưới.',
      closingEyebrow: 'TÌM THẤY BẠN GIỮA VŨ TRỤ',
      closingH2: 'Rễ xưa níu đất cội nguồn,<br>ước mơ chắp cánh bay muôn dặm trời.',
      keepExploring: 'Tiếp tục khám phá',
      readComplete: 'Đọc trọn bộ câu chuyện',
      scienceNote:
        'ROVER là nhân vật hư cấu lấy cảm hứng từ hành trình thám hiểm Mặt Trăng. Câu chuyện hòa quyện giữa truyền thuyết và khoa học có thật về động Mặt Trăng cùng gương phản xạ tia laser; chiếc xe tự hành trong tranh không phải nguyên mẫu bộ thiết bị khoa học tĩnh Apollo 11.',
      noScript: 'Hãy cuộn xuống dưới trang bìa và mở mục “Đọc trọn bộ câu chuyện” để đọc không cần hiệu ứng.',
      guideBtnLabel: 'Hỏi chuyện chú Cuội',
      guideKicker: 'NGƯỜI BẠN DƯỚI ÁNH TRĂNG',
      guideTitle: 'Hỏi chuyện chú Cuội',
      guideClose: 'Đóng hộp thoại',
      guideIntro: 'Mỗi chuyến phiêu lưu đều bắt đầu từ một câu hỏi nhỏ. Cháu đang tò mò điều gì nào?',
      guidePlaceholder: 'Hỏi về câu chuyện hoặc các người bạn nhé…',
      guideAsk: 'Hỏi chú',
      guideInputLabel: 'Câu hỏi của bạn',
      guideTopicsLabel: 'Câu hỏi gợi ý',
      guideDefaultAnswer: 'Chọn một câu hỏi phía trên hoặc tự viết điều cháu muốn hỏi nhé.',
      guideNote: 'Đây là góc hỏi đáp có sẵn đi kèm sách tranh. Mọi câu hỏi đều chỉ nằm trên trình duyệt này và không được gửi đi đâu cả.',
      guideBegin: 'Bắt đầu hành trình →',
      topics: {
        story: 'Bắt đầu đọc từ đâu?',
        cuoi: 'Chú Cuội là ai?',
        rabbit: 'Làm quen Thỏ Ngọc',
        rover: 'ROVER là ai thế?',
        feelings: 'Khi thấy bị lãng quên',
      },
      answers: {
        story: 'Cháu chỉ cần nhấn “Khởi hành khám phá” hoặc nhẹ nhàng cuộn trang xuống. Tất cả 22 bức tranh màu nước sẽ lần lượt mở ra qua sáu hồi truyện và một đoạn kết thật êm.',
        cuoi: 'Ta là chú Cuội, người kể chuyện bên gốc đa cổ thụ trên cung trăng. Câu chuyện này đan dệt huyền tích Trung Thu Việt Nam với dấu chân khoa học trên Mặt Trăng. Ngồi xuống nghe cùng ta một lát nhé!',
        rabbit: 'Thỏ Ngọc là người bạn lém lỉnh, hay tò mò luôn đồng hành cùng ta trong từng trang tranh màu nước này.',
        rover: 'ROVER là chú robot bốn bánh biết nói trong trí tưởng tượng của chúng ta, lấy cảm hứng từ những thiết bị đo địa chấn và gương phản xạ laser ngoài đời thật của NASA.',
        tree: 'Cụ Đa cổ thụ là người giữ gìn ký ức. Những chùm rễ vươn xa nhắc rằng cả điều nhỏ bé nhất hôm nay cũng có thể nuôi lớn ước mơ ngày mai.',
        feelings: 'Cảm giác bị lãng quên chẳng dễ chịu chút nào. Cháu xứng đáng được lắng nghe và sẻ chia, ngay cả trong những ngày lặng lẽ nhất. Hãy mở lòng với một người thân hoặc rủ một người bạn cùng bước vào cuộc phiêu lưu nhỏ nhé.',
        sound: 'Tiếng tích tắc chỉ hiện lên trong lời thoại chứ trang sách này không phát âm thanh. Ngoài vũ trụ chân không, âm thanh không thể tự truyền đi được đâu!',
        chapters: 'Hãy theo bước qua từng hồi: Mở Đầu, Bạn Nhỏ Giữa Lớp Bụi, Cỗ Xe Lặng Im, Đêm Lạnh Nhất, Tia Sáng Mảnh Mai, Tìm Thấy Bạn và Cội Rễ Ngày Mai.',
        motion: 'Chính thao tác cuộn trang của cháu sẽ dẫn dắt từng khung tranh và dòng thoại. Nếu thiết bị bật chế độ giảm chuyển động, tranh sẽ chuyển trực tiếp nhẹ nhàng hơn.',
        fallback: 'Chú có sẵn vài câu chuyện về sách tranh, Thỏ Ngọc, cây đa, bạn ROVER hay những nỗi niềm vu vơ. Cháu bấm chọn một chủ đề bên trên nhé!',
      },
      rules: [
        ['feelings', /quen|buon|co don|lac long|mot minh|sad|lonely|forgot/],
        ['rover', /rover|xe|robot|apollo|may|guong/],
        ['rabbit', /tho|ngoc|rabbit|bunny/],
        ['tree', /da|cay|re|banyan|tree|root/],
        ['cuoi', /cuoi|chu|truyen thuyet|co tich|folklore/],
        ['sound', /am thanh|tich tac|nghe|sound|tick|audio/],
        ['motion', /chuyen dong|cuon|motion|scroll|animat/],
        ['chapters', /chuong|hoi|phan|scene|chapter/],
        ['story', /bat dau|doc|cach|help|story|start|begin/],
      ],
      sceneLabels: {
        'SCENE 01 — OPENING': 'HỒI 01 — ĐÊM TRĂNG MỞ LỐI',
        'SCENE 02 — THE LITTLE ONE IN THE DUST': 'HỒI 02 — BẠN NHỎ GIỮA LỚP BỤI MỜ',
        'SCENE 03 — THE ROVER THAT WENT QUIET': 'HỒI 03 — CỖ XE LẶNG IM',
        'SCENE 04 — THE COLDEST NIGHT': 'HỒI 04 — ĐÊM LẠNH NHẤT',
        'SCENE 05 — A THIN LINE OF LIGHT': 'HỒI 05 — TIA SÁNG MẢNH MAI',
        'SCENE 06 — FIND YOU': 'HỒI 06 — TÌM THẤY BẠN',
        'CLOSING — THE ROOTS OF TOMORROW': 'KẾT TRUYỆN — CỘI RỄ CHO NGÀY MAI',
      },
      speakers: {
        'NARRATOR': 'NGƯỜI KỂ CHUYỆN',
        'MOON RABBIT': 'THỎ NGỌC',
        'UNCLE CUOI': 'CHÚ CUỘI',
        'ROVER': 'ROVER',
        'BANYAN TREE': 'CỤ ĐA CỔ THỤ',
        'CHILD': 'EM NHỎ',
        'ALL CHARACTERS': 'TẤT CẢ',
        '': '',
      },
      captions: {
        1: [
          'Đêm nào cũng vậy, chú Cuội vẫn ngồi tựa gốc đa.',
          'Ai ở trần gian cũng nhớ hai điều về chú: chú mê kể chuyện, và cứ trăng tròn là lại thấy bóng chú trên cung trăng.',
        ],
        2: [
          'Đêm hội Trung Thu ấy, vầng trăng sáng vằng vặc hơn bao giờ hết.',
          'Dưới tán đa vàng rực, chú Cuội đang thủ thỉ kể cho Thỏ Ngọc nghe một tích xưa.',
        ],
        3: [
          'Chợt có một âm thanh khe khẽ khẽ lay động màn đêm tĩnh mịch.',
          'Chú ơi! Tiếng gì thế ạ?',
          'Tích... tắc... Thỏ ơi, hình như ngoài kia có ai vừa thức giấc.',
          'Lại chuyện chú Cuội bày ra trêu cháu đúng không?',
          'Lần này thật đấy. Đi theo chú nào!',
        ],
        4: [
          'Lần theo tiếng tích tắc lạ lùng, chú Cuội và Thỏ Ngọc bắt gặp một nhà thám hiểm xưa cũ nằm lặng lẽ giữa bụi trăng.',
          'Năm tháng rất xa xưa, các phi hành gia từng ghé lại nơi này, mang theo máy móc và khát vọng khám phá bầu trời.',
        ],
        5: [
          'Xin chào? Các bạn... là thật ư?',
          'Á! Nó biết nói kìa chú ơi!',
          'Mình là ROVER. Ngày trước, mình từng cùng con người đi khắp mặt trăng.',
        ],
        6: [
          'Mình có đôi tai lắng nghe Mặt Trăng khẽ rung mình, cùng một tấm gương nhỏ.',
          'Thế rồi ai nấy đều bay về nhà. Họ quên mất mình rồi sao?',
          'Sao họ lại đành lòng bỏ quên bạn được chứ?',
          'Thực ra, nhiều thiết bị được cố ý ở lại Mặt Trăng để lặng thầm gửi tri thức về cho các nhà khoa học Trái Đất.',
        ],
        7: [
          'Chú Cuội và Thỏ Ngọc nhẹ nhàng đưa người bạn mới về dưới bóng cây đa cổ thụ — nơi cất giữ mọi miền ký ức.',
        ],
        8: [
          'Kể ta nghe xem nào, ROVER bé nhỏ. Đôi tai của cháu đã nghe thấy những chi?',
          'Cháu đã nghe tiếng động đất trên Mặt Trăng, và cả tiếng những mảnh đá vũ trụ rơi khẽ xuống bụi xám.',
        ],
        9: [
          'Cháu làm việc được chừng ba tuần lễ. Rồi một ngày, mọi tín hiệu bỗng lịm tắt.',
          'Chỉ vỏn vẹn ba tuần thôi ư? Thế là chấm hết rồi sao?',
        ],
        10: [
          'Ba tuần ấy là quá đủ để gieo mầm cho những điều phi thường.',
          'Từng nhịp đo của cháu đã giúp con người chế tạo nên những cỗ máy tinh xảo hơn cho muôn chuyến bay sau.',
        ],
        11: [
          'Nhưng giờ đây bốn bề lặng ngắt như tờ.',
          'Chẳng ai gọi tên, cũng chẳng ai đáp lời. Chắc cháu bị lãng quên thật rồi...',
        ],
        12: [
          'ROVER ơi... thế tấm gương nhỏ kia vẫn còn dùng được chứ?',
          'Nó chỉ là thủy tinh thôi. Không pin, chẳng có lấy một sợi dây điện.',
          'Nó chẳng thể cất tiếng gọi ai. Nó chỉ biết lặng im chờ đợi.',
        ],
        13: [
          'Chú hiểu nỗi lòng ấy chứ. Bao lần nói lời thật thà mà chẳng một ai tin.',
          'Có lẽ, tất cả chúng mình ở đây đều đang chờ một lời hồi âm.',
        ],
        14: [
          'Kìa chú! Một tia sáng xanh vút lên từ Trái Đất!',
          'Đó là tia laser đấy! Dưới kia, các nhà khoa học vẫn đang rọi sáng về chiếc gương nhỏ của cháu.',
        ],
        15: [
          'Tấm gương của cháu ư? Sau chừng ấy năm tháng đằng đẵng?',
          'Phải rồi! Nó hắt tia sáng trở về Trái Đất, giúp loài người đo từng tấc khoảng cách tới Mặt Trăng.',
        ],
        16: [
          'Vậy ra... cháu vẫn đang góp chút sức nhỏ bé cho cuộc khám phá này ư?',
          'Dĩ nhiên rồi, bạn nhỏ. Cháu chưa bao giờ bị lãng quên cả.',
          'Thế thì câu chuyện của cháu vẫn còn viết tiếp!',
        ],
        17: [
          'Nhìn xem nào, ROVER. Ánh sáng từ việc cháu làm đã chạm tới nơi xa xôi hơn mọi tưởng tượng.',
        ],
        18: [
          'Xa tít dưới ánh trăng nơi Trái Đất, có một em nhỏ đang nắn nót vẽ chiếc xe tự hành bên khung cửa sổ.',
          'Biết đâu người thám hiểm Mặt Trăng mai sau sẽ là mình...',
          'Hoặc biết đâu... chính là BẠN!',
        ],
        19: [
          'Có ai đó tận dưới kia đang mơ về vầng trăng này sao?',
          'Ừ đấy. Và biết đâu một ngày không xa, đứa trẻ ấy sẽ chạm tới những chân trời ta chưa từng dám mơ.',
        ],
        20: [
          'Biết đâu nhà thám hiểm vĩ đại tiếp theo đang ngồi ngay trước mắt chúng mình kìa!',
          'Mọi khám phá diệu kỳ đều nảy mầm từ một ánh mắt biết tò mò.',
        ],
        21: [
          'Và mọi ước mơ lớn lao đều bắt đầu từ một trái tim dám nghĩ suy bay bổng.',
          'FIND U IN THE YOUNIVERSE!',
        ],
        22: [
          'Cội rễ nhắc bạn nhớ mình đến từ đâu.',
          'Còn ước mơ sẽ mở lối xem bạn đi được bao xa.',
        ],
      },
    },

    'zh-CN': {
      docTitle: '在星海中遇见你 · 月球故事水彩绘本',
      metaDesc: '老根深扎月土，新梦振翅云霄。由 22 幅手绘水彩插画娓娓道来的月球物语。',
      skip: '阅读纯文字完整故事',
      brand: '月球水彩绘本',
      openingEyebrow: '一段越过群星的月夜故事',
      titleLine1: '星河之根',
      titleLine2: '月下新梦',
      tagline: '老根深扎月土，新梦振翅云霄。',
      beginBtn: '开启月夜之旅',
      assetError: '这幅插画暂时无法加载。你可以直接阅读下方的完整故事文本。',
      closingEyebrow: '在宇宙中遇见你',
      closingH2: '老根深扎月土，<br>新梦振翅云霄。',
      keepExploring: '继续探索宇宙',
      readComplete: '展开阅读完整故事',
      scienceNote:
        'ROVER 是受真实探月工程启发而创作的童话角色。本故事融合了月震监测与激光测距反射镜的真实科学原理；画面中的轮式小车并非阿波罗 11 号当年留下的静态科学实验站原型。',
      noScript: '请向下滚动至封面下方，打开“展开阅读完整故事”即可无动画阅读全文。',
      guideBtnLabel: '问问阿舅 Cuội',
      guideKicker: '月色下的引路人',
      guideTitle: '问问 Cuội 叔叔',
      guideClose: '关闭向导',
      guideIntro: '每一段冒险都从一次好奇的发问开始。你想知道些什么呢？',
      guidePlaceholder: '聊聊这个故事，或问问月宫里的朋友们吧…',
      guideAsk: '提问',
      guideInputLabel: '你的问题',
      guideTopicsLabel: '推荐问题',
      guideDefaultAnswer: '点击上方任意问题，或者自己写下一个想问的话题吧。',
      guideNote: '这是一本自带暖心解答的绘本小向导。你的提问只留在当前浏览器中，不会保存或发送给任何人。',
      guideBegin: '翻开冒险篇章 →',
      topics: {
        story: '该从哪里看起？',
        cuoi: 'Cuội 叔叔是谁？',
        rabbit: '认识一下玉兔',
        rover: 'ROVER 是谁呀？',
        feelings: '觉得自己被遗忘了',
      },
      answers: {
        story: '只要点击“开启月夜之旅”，或者顺着页面轻轻往下滑动，22 幅水彩画就会顺着六幕剧情缓缓舒展开来。向上滚动还能重温任何一句对白。',
        cuoi: '我是坐在月宫老榕树下讲故事的 Cuội 叔叔。这个故事把越南的中秋月亮传说和人类真实登月的点滴记忆编织在了一起，留步陪我们坐一会儿吧。',
        rabbit: '玉兔是我在这组水彩画里最机灵、也最好奇的小旅伴！',
        rover: 'ROVER 是我们故事里会说话的四轮月面小探险家，名字和灵感源自真实的月震仪与阿波罗激光反射镜。',
        tree: '老榕树守护着所有被留下的记忆。哪怕再微小的发现，也能像种子一样在未来长成大大的梦想。',
        feelings: '觉得被人遗忘一定会有些孤单和委屈吧。即使在最安静的日子里，你依然值得温柔与陪伴。试着和信任的人说说心里话，或者约个朋友一起散散心吧。',
        sound: '滴答声只存在于故事字句中，绘本页面本身不会发出声音——在真空的月球表面，声音本来也传不出去呢。',
        chapters: '故事依次走过：序幕、月尘里的小家伙、沉睡的巡视车、最冷的夜、一束微光、遇见你，以及明日之根。',
        motion: '随着你指尖的滑动，每一页插画和字幕都会徐徐切换；若开启了系统“减少动态效果”，画面会采用更轻柔的静谧过渡。',
        fallback: '我这里藏着关于玉兔、老榕树、ROVER、心情故事和阅读小技巧的答案，试着点一点上面的问题吧！',
      },
      rules: [
        ['feelings', /忘|孤单|寂寞|难过|一个人|sad|lonely|forgot/],
        ['rover', /rover|巡视车|小车|机器人|阿波罗|镜子/],
        ['rabbit', /兔|玉兔|rabbit|bunny/],
        ['tree', /树|榕树|根|banyan|tree/],
        ['cuoi', /cuoi|叔叔|传说|中秋|神话/],
        ['sound', /声音|滴答|听|sound|tick/],
        ['motion', /动画|滑动|滚动|motion|scroll/],
        ['chapters', /章节|剧情|哪一幕|scene|chapter/],
        ['story', /开始|怎么读|怎么玩|帮助|start|story/],
      ],
      sceneLabels: {
        'SCENE 01 — OPENING': '第一幕 — 月夜序曲',
        'SCENE 02 — THE LITTLE ONE IN THE DUST': '第二幕 — 月尘里的小小守望者',
        'SCENE 03 — THE ROVER THAT WENT QUIET': '第三幕 — 归于沉寂的小车',
        'SCENE 04 — THE COLDEST NIGHT': '第四幕 — 最寒冷的月夜',
        'SCENE 05 — A THIN LINE OF LIGHT': '第五幕 — 跨越星空的微光',
        'SCENE 06 — FIND YOU': '第六幕 — 在星海中找到你',
        'CLOSING — THE ROOTS OF TOMORROW': '尾声 — 伸向明天的树根',
      },
      speakers: {
        'NARRATOR': '旁白',
        'MOON RABBIT': '玉兔',
        'UNCLE CUOI': 'Cuội 叔叔',
        'ROVER': 'ROVER',
        'BANYAN TREE': '古榕树',
        'CHILD': '地球上的孩子',
        'ALL CHARACTERS': '众人齐声',
        '': '',
      },
      captions: {
        1: ['每一个夜晚，Cuội 叔叔都静静坐在他的大榕树下。', '人们都知道他有两件事从未改变：他最爱讲故事，也总会在每一个满月夜如约现身。'],
        2: ['那年中秋的夜里，月亮比往常更加澄澈明亮。', '在古老金榕树的树荫下，Cuội 叔叔正兴致勃勃地给玉兔讲着一段尘封往事。'],
        3: ['忽然，一声极其微弱的轻响划破了静夜。', '叔叔！那是什么声音？', '嘀嗒……嘀嗒……小兔，外面好像有什么东西醒过来了。', '这该不会又是您现编出来唬人的神话吧？', '这回可不是玩笑，跟紧我走吧！'],
        4: ['循着神秘的声响走去，一人一兔在厚厚的月尘里发现了一位独守已久的旧日旅者。', '很久很久以前，宇航员曾登上月球，带来了精密仪器与飞翔的梦想。'],
        5: ['你好……你们是真的吗？', '呀！它竟然会说话！', '我是 ROVER。很久以前，我曾陪着人类一起探索这片银白世界。'],
        6: ['我曾有一双倾听月震的耳朵，背上还装着一面小小镜子。', '后来大家全都回去了。是不是……再也记不起我了？', '他们怎么会舍得把你遗忘在这儿呢？', '其实有些仪器正是为了留在月面，才能长久地向科学家传回地球之外的秘密。'],
        7: ['Cuội 叔叔与玉兔带着这位孤单的新朋友，走向守望岁月记忆的古榕树。'],
        8: ['孩子，讲给我听听——你的耳朵都曾在月面听见了什么？', '我听见了月球深处传来的微微震颤，也听见陨石叩击月尘的回响。'],
        9: ['我辛勤聆听了大约三周。可有一天，信号突然中断了。', '只有短短三周吗……难道一切就这样结束了吗？'],
        10: ['短短三周，便已足以点燃一件了不起的事业。', '你留下的点滴记录，教会科学家造出更敏锐的双眼与耳朵，奔向更遥远的深空。'],
        11: ['可如今，四周再没有一点回音。', '再无人呼唤我，也无人应答。我大概，真的被世界忘记了吧。'],
        12: ['ROVER……你身上那面小镜子，如今还能用吗？', '那不过是一块玻璃，没有电池，也没有一根导线。', '它无法开口呼唤谁，只能在这里安静地等待。'],
        13: ['那种滋味我最懂。说了千百句真话，却总是无人肯信。', '或许我们呀，都只是在等一个听得见自己的人。'],
        14: ['快看呀！一束绿光从蓝色的地球飞过来了！', '那是激光！地球上的科学家正在把光束穿过三十八万公里，温柔地投向你的小镜子。'],
        15: ['找我的镜子吗？过了这么多年之后……还找它？', '是啊！它正稳稳把光送回地球，帮人类分毫不差地丈量月地之间的距离呢。'],
        16: ['这么说……直到今天，我依然在帮大家发现宇宙吗？', '当然了，小家伙。你从未被时光遗忘。', '那我的故事，就还远远没有讲完！'],
        17: ['抬眼看看吧，ROVER——你种下的光，早已照进了比你想象中更遥远的心灵。'],
        18: ['在遥远的地球窗前，一个孩子正沐浴着清凉月光，认真画下一辆月球车。', '说不定未来的探月英雄，就是我自己呢……', '又或者，正是此刻读着故事的——你！'],
        19: ['地球上真的有人，正在做着登上月球的梦吗？', '是啊。说不定有朝一日，那个孩子会触及我们连做梦都不敢想的星辰。'],
        20: ['下一位伟大的探索者，也许就在这温柔月色里成长呢！', '每一个壮阔的发现，都始于一颗跃跃欲试的好奇之心。'],
        21: ['而每一段滚烫的梦想，都源自一位敢于放飞想象的少年。', '在星海中遇见你 · FIND U IN THE YOUNIVERSE!'],
        22: ['树根会提醒你，来自何方热土；', '梦想将丈量出，你能去往多远的星空。'],
      },
    },

    es: {
      docTitle: 'Encuéntrate en el Universo · Cuento Lunar en Acuarela',
      metaDesc: 'Raíces hondas sostienen la memoria; nuevos sueños alzan el vuelo. Un relato ilustrado en 22 acuarelas pintadas a mano.',
      skip: 'Leer la historia completa en texto',
      brand: 'Cuentos de la Luna',
      openingEyebrow: 'UNA HISTORIA MÁS ALLÁ DE LAS ESTRELLAS',
      titleLine1: 'LAS RAÍCES',
      titleLine2: 'DE LA GALAXIA',
      tagline: 'Raíces hondas guardan el ayer; nuevos sueños aprenden a volar.',
      beginBtn: 'Comenzar la aventura',
      assetError: 'No se pudo cargar esta lámina. La historia completa sigue disponible justo debajo.',
      closingEyebrow: 'ENCUÉNTRATE EN EL UNIVERSO',
      closingH2: 'Raíces hondas guardan el ayer;<br>nuevos sueños aprenden a volar.',
      keepExploring: 'Seguir explorando',
      readComplete: 'Leer todo el relato',
      scienceNote:
        'ROVER es un personaje de ficción inspirado en la exploración lunar real. Este cuento entrelaza ciencia verdadera sobre lunamotos y retrorreflectores láser; el vehículo ilustrado no representa el paquete estático de instrumentos de Apolo 11.',
      noScript: 'Desplázate bajo la portada y abre «Leer todo el relato» para disfrutar del cuento sin animaciones.',
      guideBtnLabel: 'Pregúntale al Tío Cuội',
      guideKicker: 'TU COMPAÑERO BAJO LA LUNA',
      guideTitle: 'Pregúntale al Tío Cuội',
      guideClose: 'Cerrar guía',
      guideIntro: 'Toda gran aventura comienza con una buena pregunta. ¿Qué te intriga hoy?',
      guidePlaceholder: 'Pregunta sobre la historia o nuestros amigos…',
      guideAsk: 'Preguntar',
      guideInputLabel: 'Tu pregunta',
      guideTopicsLabel: 'Preguntas sugeridas',
      guideDefaultAnswer: 'Elige una pregunta arriba o escribe lo que tengas en mente.',
      guideNote: 'Esta pequeña guía vive dentro del propio libro. Todo lo que escribas permanece en tu navegador y nunca se envía fuera.',
      guideBegin: 'Empezar la aventura →',
      topics: {
        story: '¿Por dónde empiezo?',
        cuoi: '¿Quién es Cuội?',
        rabbit: 'Conoce al Conejo Lunar',
        rover: '¿Quién es ROVER?',
        feelings: 'A veces me siento olvidado',
      },
      answers: {
        story: 'Pulsa «Comenzar la aventura» o simplemente desliza hacia abajo. Las 22 acuarelas se irán revelando entre seis escenas y un cierre sereno. Sube cuando quieras para releer cualquier frase.',
        cuoi: 'Soy el Tío Cuội, el narrador bajo el baniano dorado. Nuestro relato une una antigua leyenda lunar vietnamita con la emoción real de explorar la Luna. Siéntate con nosotros un momento.',
        rabbit: 'El Conejo Lunar es mi inseparable y curioso compañero en estas láminas pintadas a mano.',
        rover: 'ROVER es un explorador parlante nacido de la imaginación, inspirado en los sismómetros lunares y en los espejos láser que todavía devuelven luz desde la Luna.',
        tree: 'El viejo baniano custodia las memorias. Sus raíces nos recuerdan que incluso la semilla más discreta puede sostener grandes sueños mañana.',
        feelings: 'Sentirse olvidado duele. Mereces escucha, ternura y compañía hasta en los días más silenciosos. Cuéntale cómo te sientes a alguien de confianza o comparte un pequeño viaje con un amigo.',
        sound: 'Ese tictac vive en nuestras palabras, pero esta página no reproduce sonido. En el vacío de la Luna, ningún ruido podría viajar por el aire.',
        chapters: 'Recorreremos El Despertar, El Pequeño en el Polvo, El Rover que Guardó Silencio, La Noche más Fría, Un Hilo de Luz, Encuéntrate y Las Raíces del Mañana.',
        motion: 'Tu desplazamiento controla cada acuarela y cada diálogo. Si tienes activada la reducción de movimiento, las imágenes cambian con suavidad sin fundidos bruscos.',
        fallback: 'Guardo respuestas preparadas sobre nuestro cuento, el Conejo, el baniano, ROVER o lo que estás sintiendo. Prueba elegir uno de los botones de arriba.',
      },
      rules: [
        ['feelings', /olvid|solo|sola|triste|sentir|feel|lonely|forgot/],
        ['rover', /rover|robot|instrumento|apollo|espejo/],
        ['rabbit', /conejo|liebre|rabbit|bunny/],
        ['tree', /arbol|baniano|raiz|raices|tree|banyan/],
        ['cuoi', /cuoi|tio|leyenda|folklore/],
        ['sound', /sonido|tic|escuchar|sound|tick|audio/],
        ['motion', /movimiento|deslizar|animacion|motion|scroll/],
        ['chapters', /capitulo|escena|parte|chapter|scene/],
        ['story', /empezar|inicio|leer|ayuda|story|start|begin/],
      ],
      sceneLabels: {
        'SCENE 01 — OPENING': 'ESCENA 01 — APERTURA BAJO LA LUNA',
        'SCENE 02 — THE LITTLE ONE IN THE DUST': 'ESCENA 02 — EL PEQUEÑO ENTRE EL POLVO',
        'SCENE 03 — THE ROVER THAT WENT QUIET': 'ESCENA 03 — EL EXPLORADOR QUE ENMUDECIÓ',
        'SCENE 04 — THE COLDEST NIGHT': 'ESCENA 04 — LA NOCHE MÁS FRÍA',
        'SCENE 05 — A THIN LINE OF LIGHT': 'ESCENA 05 — UN HILO DELGADO DE LUZ',
        'SCENE 06 — FIND YOU': 'ESCENA 06 — ENCUÉNTRATE',
        'CLOSING — THE ROOTS OF TOMORROW': 'CIERRE — LAS RAÍCES DEL MAÑANA',
      },
      speakers: {
        'NARRATOR': 'NARRADOR',
        'MOON RABBIT': 'CONEJO LUNAR',
        'UNCLE CUOI': 'TÍO CUỘI',
        'ROVER': 'ROVER',
        'BANYAN TREE': 'ÁRBOL BANIANO',
        'CHILD': 'NIÑO / NIÑA',
        'ALL CHARACTERS': 'TODOS JUNTOS',
        '': '',
      },
      captions: {
        1: ['Cada noche, el tío Cuội se sienta bajo la sombra serena de su baniano.', 'Todo el mundo sabe dos cosas sobre él: adora contar historias y siempre aparece cuando la luna está llena.'],
        2: ['Aquella noche del Festival de Medio Otoño, la Luna brillaba más clara que nunca.', 'Al abrigo de su anciano baniano, Cuội le contaba al Conejo Lunar un viejo relato.'],
        3: ['De pronto, un leve latido rompió la quietud plateada.', '¡Tío! ¿Qué es ese sonido?', 'Tic... tac... Conejo, creo que algo allá fuera sigue vivo.', '¿No será otro de tus cuentos fantásticos?', 'Esta vez va en serio. ¡Ven conmigo!'],
        4: ['Siguiendo aquel misterioso compás, Cuội y el Conejo hallaron a un viejo explorador detenido en soledad entre el polvo lunar.', 'Mucho tiempo atrás habían llegado astronautas con instrumentos delicados y enormes sueños.'],
        5: ['¿Hola? ¿De verdad están ahí?', '¡Pero si habla!', 'Soy ROVER. Hubo un tiempo en que ayudé a los humanos a recorrer la Luna.'],
        6: ['Tenía un oído atento a los temblores de la Luna… y un espejito.', 'Después todos regresaron a casa. ¿Será que ya me olvidaron?', '¿Por qué iban a olvidarse de ti?', 'Algunos instrumentos fueron pensados para quedarse en la Luna y seguir enviando secretos a quienes miran desde la Tierra.'],
        7: ['Cuội y el Conejo acompañaron con cuidado a su nuevo amigo hasta el anciano baniano, guardián de todas las memorias.'],
        8: ['Cuéntame, pequeño ROVER: ¿qué logró escuchar tu oído en estas llanuras?', 'Escuché los sismos profundos de la Luna y el golpeteo de rocas errantes del espacio.'],
        9: ['Trabajé unas tres semanas. Luego, un día sin más, mi voz se apagó.', '¿Solo tres semanas? ¿Y ahí terminó todo?'],
        10: ['Tres semanas bastaron para encender algo extraordinario.', 'Tus hallazgos ayudaron a construir instrumentos mejores para quienes viajarían mucho después.'],
        11: ['Pero ahora solo queda este silencio inmenso.', 'Nadie llama, nadie responde. Creo que el mundo me olvidó.'],
        12: ['ROVER… ¿y tu espejito sigue funcionando?', 'Es solo vidrio. No guarda baterías ni cables.', 'No puede llamar a nadie; tan solo sabe esperar.'],
        13: ['Conozco muy bien esa sensación. Dices la verdad y nadie te cree.', 'Tal vez todos aquí estemos simplemente esperando.'],
        14: ['¡Mira! ¡Una luz viene viajando desde la Tierra!', 'Es un rayo láser: los científicos siguen buscando tu pequeño espejo desde lejos.'],
        15: ['¿Mi espejo? ¿Después de tantos años?', '¡Sí! Rebota la luz de vuelta a la Tierra para medir con exactitud la distancia hasta la Luna.'],
        16: ['Entonces… ¿sigo ayudando a descubrir cosas nuevas?', 'Claro que sí, pequeño. Nunca fuiste olvidado.', '¡Entonces mi historia todavía no termina!'],
        17: ['Asómate, pequeño: lo que descubriste llegó mucho más lejos de lo que jamás imaginaste.'],
        18: ['Muy lejos de allí, en la Tierra, una niña dibujaba un explorador lunar bajo el resplandor de la ventana.', 'Quizás quien explore esas estrellas sea yo…', 'O quizás… ¡seas TÚ!'],
        19: ['¿Alguien en la Tierra sueña con explorar la Luna?', 'Sí. Y tal vez algún día ese corazón curioso descubra maravillas que ni siquiera soñamos.'],
        20: ['¡Quién sabe si el próximo gran explorador nos está mirando ahora mismo!', 'Todo gran hallazgo nace de una mente despierta y curiosa.'],
        21: ['Y todo sueño despega cuando alguien se atreve a imaginar.', '¡ENCUÉNTRATE EN EL YOUNIVERSE!'],
        22: ['Tus raíces te recuerdan de dónde vienes.', 'Tus sueños deciden hasta dónde podrás llegar.'],
      },
    },

    ja: {
      docTitle: '星海のなかで君を見つける · 月の水彩絵本',
      metaDesc: '古き根は大地を抱き、新たな夢は星へ翔ける。22枚のやさしい手描き水彩画で紡ぐ、月と忘れられた探査機の物語。',
      skip: '本文テキストをすべて読む',
      brand: '月の水彩えほん',
      openingEyebrow: '星々のかなたから届いた物語',
      titleLine1: '銀河をむすぶ',
      titleLine2: 'お月さまの根っこ',
      tagline: '古き根はルーツを忘れず、新たな夢は星へと飛び立つ。',
      beginBtn: '冒険をはじめる',
      assetError: '挿絵を読み込めませんでした。ページ下部から物語の全文をお読みいただけます。',
      closingEyebrow: '宇宙のどこかで君と出会う',
      closingH2: '古き根はルーツを忘れず、<br>新たな夢は星へと飛び立つ。',
      keepExploring: 'もっと宇宙を旅する',
      readComplete: '物語をすべて読む',
      scienceNote:
        'ROVERは実際の月探査から着想を得た創作キャラクターです。この絵本には月震観測やレーザー反射鏡といった本物の科学が織り込まれていますが、挿絵の四輪ローバーはアポロ11号の静置観測装置そのものではありません。',
      noScript: '表紙の下へスクロールして「物語をすべて読む」を開くと、アニメーションなしで全文をご覧いただけます。',
      guideBtnLabel: 'クオイおじさんに聞く',
      guideKicker: '月あかりの案内人',
      guideTitle: 'クオイおじさんに聞く',
      guideClose: '案内を閉じる',
      guideIntro: 'どんな大冒険も、ひとつの「どうして？」から始まるんだ。何か気になっていることはあるかい？',
      guidePlaceholder: '物語や仲間たちのことを聞いてみよう…',
      guideAsk: 'たずねる',
      guideInputLabel: 'あなたの質問',
      guideTopicsLabel: 'おすすめの質問',
      guideDefaultAnswer: '上の質問をえらぶか、知りたいことを書いてみてね。',
      guideNote: 'これは絵本にそっと添えられたご案内だよ。入力した言葉はこのブラウザの中だけにとどまり、外へ送られることはありません。',
      guideBegin: '物語のページへ →',
      topics: {
        story: 'どうやって読み始める？',
        cuoi: 'クオイおじさんは誰？',
        rabbit: '月のうさぎを紹介して',
        rover: 'ROVERってどんな子？',
        feelings: '忘れられたみたいにさみしい',
      },
      answers: {
        story: '「冒険をはじめる」を押すか、そのままゆっくり下へスクロールしてごらん。22枚の水彩画とセリフが、6つの場面と静かなエンディングへと案内してくれるよ。',
        cuoi: 'わたしはガジュマルの木の下で物語を語るクオイおじさんさ。ベトナムのお月見の昔話と、本当の月探査の歴史が出会う絵本へようこそ。少しくつろいでいきなよ。',
        rabbit: '月のうさぎは、好奇心いっぱいでいつもそばに寄り添ってくれるかわいい相棒だよ。',
        rover: 'ROVERは、お月さまのゆれを聴く地震計やレーザー反射鏡をモデルに生まれた、おしゃべり好きな四輪の小さな探検家さ。',
        tree: '大きなガジュマルの木は記憶の守り人。小さな発見が、やがて未来の大きな夢を育てる根っこになることを教えてくれるんだ。',
        feelings: '誰にも思い出してもらえないと感じるのはつらいよね。どんな静かな日でも、君には優しさと居場所があるはずだよ。信頼できる誰かに話してみたり、友達を小さな冒険に誘ってみるのもいいかもしれないね。',
        sound: 'チクタクという音は物語の中の描写で、このページからは音は鳴らないんだ。空気のないお月さまでは、ほんとうは音も飛んでいかないんだよ。',
        chapters: '「はじまり」「月塵の小さなともだち」「眠りについたローバー」「いちばん冷たい夜」「細いひとすじの光」「君を見つける」「明日の根っこ」と進んでいくよ。',
        motion: 'スクロールにあわせて絵と言葉がやさしく移り変わります。端末で視差・動きを減らす設定にしているときは、落ち着いた切り替えで物語を楽しめますよ。',
        fallback: 'うさぎやガジュマル、ROVER、気持ちのことなど、いくつかの質問にお答えできるよ。上のボタンから選んでみてね！',
      },
      rules: [
        ['feelings', /忘れ|さみし|寂し|悲し|ひとり|lonely|forgot/],
        ['rover', /rover|ローバー|車|ロボット|アポロ|鏡/],
        ['rabbit', /うさぎ|兎|rabbit|bunny/],
        ['tree', /木|ガジュマル|根|tree|banyan/],
        ['cuoi', /クオイ|おじさん|昔話|伝説/],
        ['sound', /音|チクタク|聞こ|sound|tick/],
        ['motion', /動き|スクロール|motion|scroll/],
        ['chapters', /章|場面|シーン|scene|chapter/],
        ['story', /始め|読み|ヘルプ|start|story/],
      ],
      sceneLabels: {
        'SCENE 01 — OPENING': '第1場 — 満月の夜の幕あけ',
        'SCENE 02 — THE LITTLE ONE IN THE DUST': '第2場 — 月塵のなかの小さな旅人',
        'SCENE 03 — THE ROVER THAT WENT QUIET': '第3場 — 静かになった探査車',
        'SCENE 04 — THE COLDEST NIGHT': '第4場 — いちばん長く寒い夜',
        'SCENE 05 — A THIN LINE OF LIGHT': '第5場 — 地球から届いた光のすじ',
        'SCENE 06 — FIND YOU': '第6場 — 君を見つける光',
        'CLOSING — THE ROOTS OF TOMORROW': 'むすび — 明日へつづく根っこ',
      },
      speakers: {
        'NARRATOR': 'かたりて',
        'MOON RABBIT': '月のうさぎ',
        'UNCLE CUOI': 'クオイおじさん',
        'ROVER': 'ROVER',
        'BANYAN TREE': 'ガジュマルの大樹',
        'CHILD': '地球のこども',
        'ALL CHARACTERS': 'みんなで',
        '': '',
      },
      captions: {
        1: ['夜ごと、クオイおじさんはガジュマルの木の下に腰を下ろします。', 'おしゃべり好きで、満月のたびに姿をあらわす——それが、誰もが知るおじさんのふしぎでした。'],
        2: ['とりわけ美しく澄みわたった、中秋の名月の夜のこと。', '古いガジュマルの木陰で、クオイおじさんは月のうさぎに昔話を聞かせていました。'],
        3: ['そのとき、静けさをそっと揺らす小さな音がひびきました。', '「おじさん！いま、なにか音がしなかった？」', '「チック…タック…うさぎよ、どうやら外に生きている誰かがいるみたいだぞ」', '「またおじさんのつくり話じゃないの？」', '「今度ばかりはほんとうさ。ほら、見にいこう！」'],
        4: ['ふしぎな音をたどっていくと、月の砂ぼこりに埋もれるように、ひとり佇む古い探査機が見つかりました。', 'はるか昔、宇宙飛行士たちがこの月に降り立ち、観測機と大きな夢を置いていったのです。'],
        5: ['「こんにちは…きみたちは、ほんとうにそこにいるの？」', '「わあ、しゃべった！」', '「ぼくはROVER。むかし、人間といっしょに月を探検していたんだ」'],
        6: ['「月のゆれを聴くお耳と、小さな鏡を背負っていたんだよ」', '「それなのに、みんな地球へ帰っていった。ぼくのこと、もう忘れちゃったのかな？」', '「どうしてそんな大事な仲間を忘れて帰ったりするもんか」', '「じつは月の秘密をずっと地球へ届けるため、あそこに残るよう作られた観測機もあったのです」'],
        7: ['クオイおじさんと月のうさぎは、新しい友達をつれて、記憶を守るガジュマルの大樹のもとへ歩きました。'],
        8: ['「話してごらん、小さなROVER。おまえの耳は、この月でどんな声を聴いてきたんだい？」', '「月の奥から響く月震の音や、宇宙から飛んでくる石ころの足音を聴いていたよ」'],
        9: ['「働けたのは三週間ほど。ある日ぱったりと、ぼくの電波は止まってしまったんだ」', '「たった三週間だけ？それで終わりだなんて、そんな…」'],
        10: ['「三週間もあれば、途方もない扉を開くにはじゅうぶんなのさ」', '「おまえが残した記録のおかげで、人々は未来の旅に向けたもっと確かな目と耳を作れたんだよ」'],
        11: ['「でも、今はなにもかもがしんとしている」', '「誰も呼んでくれない。返事もない。ぼくはもう、忘れられてしまったんだ」'],
        12: ['「ROVER…その背中の鏡は、まだ生きているのかな？」', '「ただのガラスだもの。電池も、一本の電線すらないんだ」', '「誰かを呼ぶことなんてできない。ただ、ここで待ちつづけるだけさ」'],
        13: ['「その気持ち、おじさんにはよくわかるよ。ほんとうのことを言っても、誰も信じてくれない寂しさ…」', '「もしかしたら、みんなこうして何かを待っているのかもしれないな」'],
        14: ['「見て！青い地球から、ひとすじの光が飛んでくる！」', '「あれはレーザーだよ！科学者たちが、今でもおまえの小さな鏡へ光を届けているんだ」'],
        15: ['「ぼくの鏡へ？こんなに長い年月がたってから…？」', '「そうとも！その鏡が光を地球へ跳ね返すことで、月までの正確な距離を測りつづけているんだよ」'],
        16: ['「それじゃあ…ぼくは今でも、みんなの新しい発見を手伝えているんだね？」', '「もちろんだとも、小さな旅人よ。おまえは一度だって忘れられてはいなかったんだ」', '「だったら、ぼくの物語はまだ終わっていないんだ！」'],
        17: ['「さあ見てごらん。おまえのともした光は、想像をはるかに超えた場所まで届いているよ」'],
        18: ['はるかかなたの地球で、ひとりの子どもが月あかりの机に向かい、ローバーの絵を描いていました。', '「いつか月を旅する探検家は、わたしかもしれない…」', '「あるいは…いま見ている『君』かもしれない！」'],
        19: ['「地球で、月を探検する夢を見ている子がいるんだね？」', '「ああ。いつかあの子が、わしらには思いもよらない世界を見つける日が来るかもしれないよ」'],
        20: ['「つぎの偉大な探検家は、もうすぐそこにいるのかも！」', '「すべての大発見は、ひとつの『なぜ？』を抱くまなざしから生まれます」'],
        21: ['「そしてすべての夢は、思いきって空を思い描いた誰かからはじまるのです」', 'FIND U IN THE YOUNIVERSE!'],
        22: ['自分の根っこが、あなたの帰る場所を教えてくれる。', 'そしてあなたの夢が、どこまで遠くへ翔けるかを決めるのです。'],
      },
    },
  };

  function normalizeLang(raw) {
    const val = String(raw || '').trim();
    if (!val) return 'en';
    const lower = val.toLowerCase();
    if (lower.startsWith('vi')) return 'vi';
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('ja')) return 'ja';
    return 'en';
  }

  function initialLang() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q) return normalizeLang(q);
      const saved = JSON.parse(localStorage.getItem('echo-game') || '{}');
      if (saved && saved.state && saved.state.language) return normalizeLang(saved.state.language);
    } catch (e) {}
    return 'en';
  }

  let currentLang = initialLang();
  let ENGLISH_GUIDE_TEXTS = null;
  let ENGLISH_UI = null;

  function captureEnglishUI() {
    if (ENGLISH_UI || typeof document === 'undefined') return;
    const h1Spans = document.querySelectorAll('.opening-title h1 span');
    const keepLink = document.querySelector('.keep-exploring');
    const beginLink = document.querySelector('.begin-adventure');
    ENGLISH_UI = {
      docTitle: document.title,
      metaDesc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      skip: document.querySelector('.skip')?.textContent || '',
      brand: document.querySelector('.brand span')?.textContent || '',
      openingEyebrow: document.querySelector('.opening-title > p:first-child')?.textContent || '',
      titleLine1: h1Spans[0]?.textContent || '',
      titleLine2: h1Spans[1]?.textContent || '',
      tagline: document.querySelector('.opening-title .tagline')?.textContent || '',
      beginBtn: beginLink?.childNodes[0]?.textContent?.trim() || '',
      assetError: document.querySelector('.asset-error')?.textContent || '',
      closingEyebrow: document.querySelector('#transcript > p:first-child')?.textContent || '',
      closingH2: document.querySelector('#transcript h2')?.innerHTML || '',
      keepExploring: keepLink?.childNodes[0]?.textContent?.trim() || '',
      readComplete: document.querySelector('#transcript details summary')?.textContent || '',
      scienceNote: document.querySelector('.science-note')?.textContent || '',
      noScript: document.querySelector('.no-script')?.textContent || '',
      guideBtnLabel: document.querySelector('.guide-launch')?.getAttribute('aria-label') || '',
      guideKicker: document.querySelector('#cuoi-guide .chapter-num')?.textContent || '',
      guideTitle: document.getElementById('guide-title')?.textContent || '',
      guideClose: document.querySelector('#cuoi-guide .close')?.getAttribute('aria-label') || '',
      guideIntro: document.querySelector('#cuoi-guide > p:not(.guide-note)')?.textContent || '',
      guidePlaceholder: document.getElementById('guide-question')?.getAttribute('placeholder') || '',
      guideAsk: document.querySelector('#guide-form button[type="submit"]')?.textContent || '',
      guideInputLabel: document.querySelector('label[for="guide-question"]')?.textContent || '',
      guideTopicsLabel: document.querySelector('.guide-topics')?.getAttribute('aria-label') || '',
      guideDefaultAnswer: document.getElementById('guide-answer')?.textContent || '',
      guideNote: document.querySelector('.guide-note')?.textContent || '',
      guideBegin: document.getElementById('guide-begin')?.textContent || '',
      topics: Object.fromEntries([...document.querySelectorAll('#cuoi-guide [data-topic]')].map((b) => [b.dataset.topic, b.textContent])),
    };
  }

  function applyLocale(rawLang) {
    currentLang = normalizeLang(rawLang);
    const L = LOCALES[currentLang];
    if (typeof document !== 'undefined') {
      captureEnglishUI();
      document.documentElement.lang = currentLang;
      document.title = L ? L.docTitle : ENGLISH_UI.docTitle;
      const setTxt = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
      const setHtml = (sel, val) => { const el = document.querySelector(sel); if (el) el.innerHTML = val; };
      const ui = L || ENGLISH_UI;

      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', ui.metaDesc);
      setTxt('.skip', ui.skip);
      setTxt('.brand span', ui.brand);
      setTxt('.opening-title > p:first-child', ui.openingEyebrow);
      const h1Spans = document.querySelectorAll('.opening-title h1 span');
      if (h1Spans[0]) h1Spans[0].textContent = ui.titleLine1;
      if (h1Spans[1]) h1Spans[1].textContent = ui.titleLine2;
      setTxt('.opening-title .tagline', ui.tagline);

      const beginEl = document.querySelector('.begin-adventure');
      if (beginEl) beginEl.innerHTML = `${ui.beginBtn} <span aria-hidden="true">↓</span>`;
      setTxt('.asset-error', ui.assetError);
      setTxt('#transcript > p:first-child', ui.closingEyebrow);
      setHtml('#transcript h2', ui.closingH2);
      const keepEl = document.querySelector('.keep-exploring');
      if (keepEl) keepEl.innerHTML = `${ui.keepExploring} <span aria-hidden="true">→</span>`;
      setTxt('#transcript details summary', ui.readComplete);
      setTxt('.science-note', ui.scienceNote);
      setTxt('.no-script', ui.noScript);

      const guideBtn = document.querySelector('.guide-launch');
      if (guideBtn) {
        guideBtn.setAttribute('aria-label', ui.guideBtnLabel);
        guideBtn.setAttribute('title', ui.guideBtnLabel);
      }
      setTxt('#cuoi-guide .chapter-num', ui.guideKicker);
      setTxt('#guide-title', ui.guideTitle);
      const closeBtn = document.querySelector('#cuoi-guide .close');
      if (closeBtn) closeBtn.setAttribute('aria-label', ui.guideClose);
      setTxt('#cuoi-guide > p:not(.guide-note)', ui.guideIntro);
      const input = document.getElementById('guide-question');
      if (input) input.setAttribute('placeholder', ui.guidePlaceholder);
      setTxt('#guide-form button[type="submit"]', ui.guideAsk);
      setTxt('label[for="guide-question"]', ui.guideInputLabel);
      const topicsGroup = document.querySelector('.guide-topics');
      if (topicsGroup) topicsGroup.setAttribute('aria-label', ui.guideTopicsLabel);
      document.querySelectorAll('#cuoi-guide [data-topic]').forEach((btn) => {
        const key = btn.dataset.topic;
        if (ui.topics[key]) btn.textContent = ui.topics[key];
      });
      setTxt('#guide-answer', ui.guideDefaultAnswer);
      setTxt('.guide-note', ui.guideNote);
      setTxt('#guide-begin', ui.guideBegin);
    }

    // Mutate MoonStoryData items in place so sequence.js keeps its shots reference, then notify sequence/guide.
    globalThis.MoonStoryData.forEach((shot, i) => {
      const base = ENGLISH_BASE[i];
      shot.scene = L ? (L.sceneLabels[base.scene] || base.scene) : base.scene;
      const locCaptions = L?.captions?.[shot.image];
      shot.captions.forEach((c, ci) => {
        const orig = base.captions[ci];
        c.speaker = L ? (L.speakers[orig.speaker] ?? orig.speaker) : orig.speaker;
        c.text = locCaptions?.[ci] || orig.text;
        c.emphasis = (shot.image === 18 && ci === 2) || (shot.image === 21 && ci === 1);
      });
    });

    if (typeof document !== 'undefined') {
      const details = document.querySelector('#transcript details');
      if (details) {
        const summary = details.querySelector('summary');
        details.innerHTML = '';
        if (summary) details.appendChild(summary);
        globalThis.MoonStoryData.forEach((shot) => {
          const sec = document.createElement('section');
          const h3 = document.createElement('h3');
          h3.textContent = `${shot.scene} · ${String(shot.image).padStart(2, '0')}`;
          sec.appendChild(h3);
          shot.captions.forEach((cap) => {
            const p = document.createElement('p');
            if (cap.speaker) {
              const strong = document.createElement('strong');
              strong.textContent = `${cap.speaker}: `;
              p.appendChild(strong);
            }
            p.appendChild(document.createTextNode(cap.text));
            sec.appendChild(p);
          });
          details.appendChild(sec);
        });
      }
      if (globalThis.CuoiGuide && !ENGLISH_GUIDE_TEXTS) {
        ENGLISH_GUIDE_TEXTS = { ...globalThis.CuoiGuide.answers };
      }
      if (globalThis.CuoiGuide) {
        const srcAnswers = L ? L.answers : ENGLISH_GUIDE_TEXTS;
        Object.keys(srcAnswers).forEach((k) => {
          globalThis.CuoiGuide.answers[k] = srcAnswers[k];
        });
        globalThis.CuoiGuide.extraRules = L ? L.rules : null;
      }
      if (globalThis.MoonStory?.refresh) globalThis.MoonStory.refresh();
    }
  }

  globalThis.MoonStoryI18n = {
    applyLocale,
    getLang: () => currentLang,
  };

  if (typeof document !== 'undefined') {
    applyLocale(currentLang);
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin) return;
      if (event.data && event.data.type === 'echo:set-language') {
        applyLocale(event.data.lang);
      }
    });
  }
})();
