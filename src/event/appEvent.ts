import { setNavActiveId } from '@/core/common'
import Event from './Event'
import commonState from '@/store/common/state'
import { type Source as SonglistSource } from '@/store/songlist/state'
import { type SearchType } from '@/store/search/state'
import { type PermissionPromptAction, type PermissionPromptPayload } from '@/types/permissionPrompt'
import { type AppDialogAction, type AppDialogPayload } from '@/types/appDialog'

export type VerticalSearchSource = 'all' | 'kg' | 'kw' | 'mg' | 'tx' | 'wy'
export interface VerticalSearchPagePayload {
  keyword?: string
  source?: VerticalSearchSource
  submit?: boolean
}
export interface VerticalSearchStatePayload {
  keyword: string
  source: VerticalSearchSource
}
export interface SettingsSearchStatePayload {
  keyword: string
}


// {
//   // sync: {
//   //   send_action_list: 'send_action_list',
//   //   handle_action_list: 'handle_action_list',
//   //   send_sync_list: 'send_sync_list',
//   //   handle_sync_list: 'handle_sync_list',
//   // },
// }

export class AppEvent extends Event {
  // configUpdate() {
  //   this.emit('configUpdate')
  // }

  focus() {
    this.emit('focus')
  }

  /**
   * 我的列表更新
   */
  mylistUpdated(lists: Array<LX.List.MyDefaultListInfo | LX.List.MyLoveListInfo | LX.List.UserListInfo>) {
    this.emit('mylistUpdated', lists)
  }

  /**
   * 我的列表切换
   */
  mylistToggled(id: string) {
    this.emit('listToggled', id)
  }

  /**
   * 音乐信息切换
   */
  musicToggled() {
    this.emit('musicToggled')
  }

  /**
   * 手动改变进度
   * @param progress 进度
   */
  setProgress(progress: number, maxPlayTime?: number) {
    this.emit('setProgress', progress, maxPlayTime)
  }

  /**
   * 设置音量大小
   * @param volume 音量大小
   */
  setVolume(volume: number) {
    this.emit('setVolume', volume)
  }

  /**
   * 设置是否静音
   * @param isMute 是否静音
   */
  setVolumeIsMute(isMute: boolean) {
    this.emit('setVolumeIsMute', isMute)
  }

  // 播放器事件
  play() {
    this.emit('play')
  }

  pause() {
    this.emit('pause')
  }

  stop() {
    this.emit('stop')
  }

  error() {
    this.emit('error')
  }

  // 播放器原始事件
  playerPlaying() {
    this.emit('playerPlaying')
  }

  playerPause() {
    this.emit('playerPause')
  }

  // playerStop() {
  //   this.emit('playerStop')
  // }

  playerEnded() {
    this.emit('playerEnded')
  }

  playerError() {
    this.emit('playerError')
  }

  // playerLoadeddata() {
  //   this.emit('playerLoadeddata')
  // }

  playerLoadstart() {
    this.emit('playerLoadstart')
  }

  // playerCanplay() {
  //   this.emit('playerCanplay')
  // }

  playerEmptied() {
    this.emit('playerEmptied')
  }

  playerWaiting() {
    this.emit('playerWaiting')
  }


  // 更新图片事件
  picUpdated() {
    this.emit('picUpdated')
  }

  // 更新歌词事件
  lyricUpdated() {
    this.emit('lyricUpdated')
  }

  // 更新歌词偏移
  lyricOffsetUpdate() {
    this.emit('lyricOffsetUpdate')
  }

  // 我的列表内歌曲改变事件
  myListMusicUpdate(ids: string[]) {
    if (!ids.length) return
    this.emit('myListMusicUpdate', ids)
  }

  // 下载列表改变事件
  downloadListUpdate() {
    this.emit('downloadListUpdate')
  }

  // 列表里的音乐信息改变事件
  musicInfoUpdate(musicInfo: LX.Music.MusicInfo) {
    this.emit('musicInfoUpdate', musicInfo)
  }

  changeMenuVisible(visible: boolean) {
    this.emit('changeMenuVisible', visible)
  }

  /**
   * 搜索类型改变事件
   * @param type
   */
  searchTypeChanged(type: SearchType) {
    this.emit('searchTypeChanged', type)
  }

  jumpListPosition() {
    if (commonState.navActiveId == 'nav_love') {
      this.emit('jumpListPosition')
    } else {
      global.lx.jumpMyListPosition = true
      setNavActiveId('nav_love')
      setTimeout(() => {
        this.emit('jumpListPosition')
      }, 200)
    }
  }

  changeLoveListVisible(visible: boolean) {
    this.emit('changeLoveListVisible', visible)
  }

  openPlaylistDetail(listId: string) {
    this.emit('openPlaylistDetail', listId)
  }

  togglePlayQueuePanel() {
    this.emit('togglePlayQueuePanel')
  }

  showPlayQueuePanel() {
    this.emit('showPlayQueuePanel')
  }

  hidePlayQueuePanel() {
    this.emit('hidePlayQueuePanel')
  }

  showSonglistTagList(source: SonglistSource, activeId: string) {
    this.emit('showSonglistTagList', source, activeId)
  }

  hideSonglistTagList() {
    this.emit('hideSonglistTagList')
  }

  songlistTagInfoChange(name: string, id: string) {
    this.emit('songlistTagInfoChange', name, id)
  }

  selectSyncMode(mode: LX.Sync.ModeType) {
    this.emit('selectSyncMode', mode)
  }

  userAvatarUpdated(path: string | null) {
    this.emit('userAvatarUpdated', path)
  }

  userNameUpdated(name: string) {
    this.emit('userNameUpdated', name)
  }

  userSignatureUpdated(signature: string) {
    this.emit('userSignatureUpdated', signature)
  }

  userGenderUpdated(gender: 'male' | 'female' | 'unknown') {
    this.emit('userGenderUpdated', gender)
  }

  openVerticalSearchPage(payload: VerticalSearchPagePayload) {
    this.emit('openVerticalSearchPage', payload)
  }

  verticalSearchStateUpdated(payload: VerticalSearchStatePayload) {
    this.emit('verticalSearchStateUpdated', payload)
  }

  verticalSearchPageVisibleChanged(visible: boolean) {
    this.emit('verticalSearchPageVisibleChanged', visible)
  }

  closeVerticalSearchPage() {
    this.emit('closeVerticalSearchPage')
  }

  settingsSearchStateUpdated(payload: SettingsSearchStatePayload) {
    this.emit('settingsSearchStateUpdated', payload)
  }

  showPermissionPrompt(payload: PermissionPromptPayload) {
    this.emit('showPermissionPrompt', payload)
  }

  permissionPromptResult(requestId: string, action: PermissionPromptAction) {
    this.emit('permissionPromptResult', requestId, action)
  }

  showAppDialog(payload: AppDialogPayload) {
    this.emit('showAppDialog', payload)
  }

  appDialogResult(requestId: string, action: AppDialogAction) {
    this.emit('appDialogResult', requestId, action)
  }
}


type EventMethods = Omit<EventType, keyof Event>


declare class EventType extends AppEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

export type AppEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off'>>
export const createAppEventHub = (): AppEventTypes => {
  return new AppEvent()
}
