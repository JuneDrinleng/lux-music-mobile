/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
package cn.lux.music.mobile.download;

import android.content.Context;
import androidx.work.*;
import org.json.JSONObject;
import java.util.concurrent.TimeUnit;

final class DownloadScheduler {
    static String name(String id) { return "lux-download-" + id; }
    // Persist before scheduling. Startup reconciliation repairs a kill between these steps.
    static void schedule(Context context, JSONObject item) throws Exception {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(DownloadWorker.class)
            .setInputData(new Data.Builder().putString("id", item.getString("id")).build())
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(item.optBoolean("wifiOnly") ? NetworkType.UNMETERED : NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
        item.put("state", "queued").put("error", "").put("workId", request.getId().toString());
        DownloadStore.write(context, item);
        WorkManager.getInstance(context).enqueueUniqueWork(name(item.getString("id")), ExistingWorkPolicy.REPLACE, request).getResult().get();
    }
}
