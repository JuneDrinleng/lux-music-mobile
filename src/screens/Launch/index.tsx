import { memo } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Loading from '@/components/common/Loading'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const STATUS_TEXT = 'Sync...'

export default memo(() => {
  const theme = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <View style={styles.main}>
        <View
          style={[
            styles.mark,
            {
              backgroundColor: theme['c-main-background'],
              borderColor: theme['c-border-background'],
            },
          ]}
        >
          <Image
            source={require('../../../assets/img/whitebg.png')}
            style={styles.markImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title} size={26}>Lux Music</Text>
      </View>

      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: theme['c-main-background'],
            borderColor: theme['c-border-background'],
          },
        ]}
      >
        <Loading size={16} />
        <Text
          style={styles.statusText}
          size={12}
          color={theme['c-font-label']}
          numberOfLines={2}
        >
          {STATUS_TEXT}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: scaleSizeW(24),
    paddingTop: scaleSizeH(40),
    paddingBottom: scaleSizeH(28),
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: scaleSizeW(92),
    height: scaleSizeW(92),
    borderRadius: scaleSizeW(18),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    marginTop: scaleSizeH(18),
    fontWeight: '600',
  },
  statusCard: {
    minHeight: scaleSizeH(52),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: scaleSizeW(10),
    paddingHorizontal: scaleSizeW(14),
    paddingVertical: scaleSizeH(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    flex: 1,
    marginLeft: scaleSizeW(12),
  },
})
