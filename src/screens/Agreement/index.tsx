import { memo } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'

const PACT_SECTIONS = [
  {
    title: '项目协议',
    body: '本项目基于 Apache License 2.0 发行，并附加以下补充协议（冲突时以本协议为准）。\n\n词语约定： "本项目"指 Lux Music 移动版；"使用者"指签署本协议的使用者；"官方音乐平台"指内置的酷我、酷狗、咪咕等平台统称；"版权数据"指图像、音频、名字等他人拥有所属版权的数据。',
  },
  {
    title: '一、数据来源',
    body: '1.1 各官方平台数据原理是从其公开服务器拉取数据（与未登录状态下官方 APP 获取的数据相同），经筛选合并后展示，本项目不对此数据的合法性、准确性负责。\n\n1.2 本项目本身不具备获取音频数据的能力；在线音频来自"自定义源"设置返回的链接。本项目所做的只是将希望播放的歌曲名、艺术家等信息传递给"源"，若源返回链接则直接使用，无法校验其准确性。\n\n1.3 非官方平台数据（如"我的列表"）来自使用者本地系统或连接的同步服务，本项目不对此数据的合法性、准确性负责。',
  },
  {
    title: '二、版权数据',
    body: '2.1 使用中可能产生版权数据，本项目不拥有其所有权。使用者务必在 24 小时内 清除使用本项目的过程中所产生的版权数据。',
  },
  {
    title: '三、音乐平台别名',
    body: '3.1 项目内官方音乐平台别名仅为称呼，不包含恶意。如觉不妥可联系本项目更改或移除。',
  },
  {
    title: '四、资源使用',
    body: '4.1 项目内使用的字体、图片等资源部分来源于互联网，如侵权可联系移除。',
  },
  {
    title: '五、免责声明',
    body: '5.1 因使用本项目导致的任何直接、间接、特殊、偶然或结果性损害（包括商誉损失、停工、计算机故障等）由使用者负责。',
  },
  {
    title: '六、使用限制',
    body: '6.1 本项目完全免费，开源发布于 GitHub，用于技术学习交流，不对技术可能违反当地法律作保证。\n\n6.2 禁止在违反当地法律法规的情况下使用本项目。违法违规行为由使用者承担，本项目不承担责任。',
  },
  {
    title: '七、版权保护',
    body: '7.1 要求尊重版权、支持正版。',
  },
  {
    title: '八、非商业性质',
    body: '8.1 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。',
  },
  {
    title: '九、接受协议',
    body: '9.1 使用者若使用本项目即代表接受本协议。',
  },
]

const CHEAT_TIP_SECTIONS = [
  {
    title: '安全提醒',
    body: '为了保障你的使用体验和个人权益，请注意以下事项。',
  },
  {
    title: '一、官方渠道声明',
    body: '本项目没有任何"官方社群"或"收费解锁"渠道，请注意甄别，谨防受骗。',
  },
  {
    title: '二、第三方修改版识别',
    body: '如果你在使用过程中看到广告、引流或要求付费升级，通常说明你当前使用的是第三方修改版本。',
  },
  {
    title: '三、发布渠道',
    body: '项目主要发布渠道为 GitHub，其他来源请自行判断可信度。',
  },
]

type DocType = 'pact' | 'cheat-tip'

interface AgreementProps {
  componentId: string
  mode?: 'push' | 'overlay'
  docType?: DocType
}

const CONTENT: Record<DocType, { title: string, sections: typeof PACT_SECTIONS }> = {
  pact: {
    title: '许可协议',
    sections: PACT_SECTIONS,
  },
  'cheat-tip': {
    title: '安全提醒',
    sections: CHEAT_TIP_SECTIONS,
  },
}

const SCALED_HEADER_HEIGHT = scaleSizeH(HEADER_HEIGHT)

const Agreement = ({ componentId, mode = 'push', docType = 'pact' }: AgreementProps) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const isOverlay = mode === 'overlay'
  const topPadding = statusBarHeight + scaleSizeH(24)
  const { title, sections } = CONTENT[docType]

  const handleBack = () => {
    if (isOverlay) {
      void Navigation.dismissOverlay(componentId)
    } else {
      void Navigation.pop(componentId)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <View style={[styles.topBarOuter, { paddingTop: topPadding, height: SCALED_HEADER_HEIGHT + topPadding, backgroundColor: theme['c-main-background'], borderBottomColor: theme['c-border-background'] }]}>
        <StatusBar />
        <View style={[styles.topBar, { paddingBottom: 4 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Icon name="chevron-left" size={18} color={theme['c-primary']} />
            <Text color={theme['c-primary']} size={15}>{isOverlay ? '关闭' : '返回'}</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} size={17}>{title}</Text>
          <View style={styles.backBtn} />
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle} size={16}>{section.title}</Text>
            <Text style={styles.sectionBody} color={theme['c-600']} size={14}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export default memo(Agreement)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSizeW(4),
  },
  topBarTitle: {
    fontWeight: '600',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scaleSizeW(80),
    height: '100%',
    paddingLeft: scaleSizeW(12),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(20),
    paddingBottom: scaleSizeH(32),
  },
  section: {
    marginBottom: scaleSizeH(22),
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: scaleSizeH(8),
  },
  sectionBody: {
    lineHeight: 22,
  },
})
