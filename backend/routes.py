"""API 路由层：所有 /api/* 接口与导出进度状态。"""
import os
import json
import shutil
import tempfile
import zipfile
import concurrent.futures
import tkinter as tk
from tkinter import filedialog
from typing import List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

from backend import services

router = APIRouter()

export_progress = {}


@router.get("/api/progress")
def get_progress(job_id: str):
    return export_progress.get(job_id, {"current": 0, "total": 0, "status": "idle", "file": "", "percent": 0})


@router.get("/api/select-folder")
def select_folder():
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title="选择保存位置")
        root.destroy()
        return {"folder": folder if folder else ""}
    except Exception as e:
        print(f"[目录选择异常]: {e}")
        return {"folder": ""}


# 1. 本地音频物理参数透视与已有标签检测
@router.post("/api/inspect")
async def inspect_audio(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp.name
    try:
        shutil.copyfileobj(file.file, temp)
        temp.close()
        return services.inspect_audio(temp_path, suffix)
    except Exception as e:
        print(f"[参数透视失败]: {e}")
        return {"specs": {"format": "AUDIO", "badge": "Audio", "color": "gray", "spec_text": ""}, "existing": {}}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# 2. 全球音源并发聚合检索（含曲目编号与碟片信息）
@router.get("/api/search")
def search_metadata(query: str):
    results = []
    seen_ids = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_us = executor.submit(services.fetch_itunes_region, query, "US")
        future_cn = executor.submit(services.fetch_itunes_region, query, "CN")
        us_results = future_us.result()
        cn_results = future_cn.result()

    for item in (us_results + cn_results):
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            results.append(item)

    return {"items": results[:8]}


# 3. 双语歌词时间戳对齐与合成
@router.get("/api/lyrics")
def get_lyrics(track: str, artist: str, duration: int = 0):
    ne_orig, ne_trans = services.fetch_netease_lyrics(track, artist)
    lrclib_orig = ""
    if not ne_orig:
        lrclib_orig = services.fetch_lrclib_lyrics(track, artist, duration)

    final_orig = ne_orig or lrclib_orig
    final_trans = ne_trans
    bilingual = ""
    if final_orig and final_trans:
        bilingual = services.merge_bilingual_lrc(final_orig, final_trans)

    return {
        "orig": final_orig,
        "trans": final_trans,
        "bilingual": bilingual,
        "has_translation": bool(final_trans),
        "lyrics": bilingual if bilingual else final_orig
    }


# 4. 批量导出与智能归档
@router.post("/api/batch-process")
def batch_process(
    files: List[UploadFile] = File(...),
    metadata_json: str = Form(...),
    export_lrc: bool = Form(False),
    save_to_local: bool = Form(False),
    target_folder: str = Form(""),
    organize_pattern: str = Form("original"),
    compress_for_car: bool = Form(False),
    job_id: str = Form("")
):
    try:
        meta_list = json.loads(metadata_json)
    except Exception:
        raise HTTPException(status_code=400, detail="元数据解析错误")

    total_files = len(files)
    if job_id:
        export_progress[job_id] = {
            "current": 0,
            "total": total_files,
            "status": "processing",
            "file": "正在初始化并解构音频流...",
            "percent": 25
        }

    # 模式 A: 本地目录归档直存
    if save_to_local:
        if not target_folder or not os.path.exists(target_folder):
            if job_id and job_id in export_progress:
                export_progress[job_id]["status"] = "error"
            raise HTTPException(status_code=400, detail="目标文件夹不存在")

        for i, file in enumerate(files):
            meta = meta_list[i] if i < len(meta_list) else {}
            ext = os.path.splitext(file.filename)[1].lower()

            out_audio = services.build_destination_path(target_folder, organize_pattern, meta, ext, file.filename)

            if job_id:
                calc_pct = int(25 + ((i + 0.3) / total_files) * 70)
                export_progress[job_id]["current"] = i + 1
                export_progress[job_id]["file"] = file.filename
                export_progress[job_id]["percent"] = calc_pct

            with open(out_audio, "wb") as f:
                shutil.copyfileobj(file.file, f)

            try:
                services.apply_tags_to_file(out_audio, meta, compress_for_car)
            except Exception as e:
                print(f"[写入音频失败]: {e}")

            if export_lrc and meta.get("lyrics"):
                base_without_ext = os.path.splitext(out_audio)[0]
                lrc_path = f"{base_without_ext}.lrc"
                try:
                    with open(lrc_path, "w", encoding="utf-8") as lf:
                        lf.write(meta["lyrics"])
                except Exception:
                    pass

        if job_id:
            export_progress[job_id]["percent"] = 100
            export_progress[job_id]["status"] = "done"

        try:
            os.startfile(target_folder)
        except Exception:
            pass

        return {"status": "ok", "saved_path": target_folder}

    # 模式 B: ZIP 压缩打包归档下载
    temp_dir = tempfile.mkdtemp()
    items_to_zip = []

    for i, file in enumerate(files):
        meta = meta_list[i] if i < len(meta_list) else {}
        ext = os.path.splitext(file.filename)[1].lower()

        out_audio = services.build_destination_path(temp_dir, organize_pattern, meta, ext, file.filename)
        rel_zip_name = os.path.relpath(out_audio, temp_dir)

        if job_id:
            calc_pct = int(25 + ((i + 0.3) / total_files) * 60)
            export_progress[job_id]["current"] = i + 1
            export_progress[job_id]["file"] = file.filename
            export_progress[job_id]["percent"] = calc_pct

        with open(out_audio, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            services.apply_tags_to_file(out_audio, meta, compress_for_car)
            items_to_zip.append((out_audio, rel_zip_name))
        except Exception:
            items_to_zip.append((out_audio, rel_zip_name))

        if export_lrc and meta.get("lyrics"):
            base_without_ext = os.path.splitext(out_audio)[0]
            lrc_path = f"{base_without_ext}.lrc"
            rel_lrc_name = os.path.relpath(lrc_path, temp_dir)
            try:
                with open(lrc_path, "w", encoding="utf-8") as lf:
                    lf.write(meta["lyrics"])
                items_to_zip.append((lrc_path, rel_lrc_name))
            except Exception:
                pass

    if job_id:
        export_progress[job_id]["file"] = "正在压缩封装为 ZIP..."
        export_progress[job_id]["percent"] = 90

    zip_path = os.path.join(temp_dir, "Tagged_Music.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fpath, arcname in items_to_zip:
            zf.write(fpath, arcname=arcname)

    if job_id:
        export_progress[job_id]["percent"] = 100
        export_progress[job_id]["status"] = "done"

    return FileResponse(zip_path, media_type="application/zip", filename="Tagged_Music.zip")
