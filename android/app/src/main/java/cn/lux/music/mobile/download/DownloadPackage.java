/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.*;
import com.facebook.react.uimanager.ViewManager;
import java.util.*;
public class DownloadPackage implements ReactPackage {
    @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) { return Collections.singletonList(new DownloadModule(context)); }
    @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Collections.emptyList(); }
}
