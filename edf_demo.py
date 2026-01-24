#!/usr/bin/env python3
"""
EDF文件查看器 - 用于读取和可视化EEG数据
EDF File Viewer - For reading and visualizing EEG data

作者 (Author): Demo Script
日期 (Date): 2026-01-23
"""

import sys
import os
from pathlib import Path
import warnings

# 检查依赖
try:
    import mne
    import matplotlib
    matplotlib.use('TkAgg')  # 使用交互式后端
    import matplotlib.pyplot as plt
except ImportError as e:
    print(f"错误: 缺少必要的依赖库")
    print(f"Error: Missing required library: {e}")
    print("\n请安装以下依赖:")
    print("Please install: pip install mne matplotlib")
    sys.exit(1)

warnings.filterwarnings('ignore')


def print_header(title: str):
    """打印标题"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_metadata(raw: mne.io.Raw, filename: str):
    """打印EDF文件的元数据"""
    print_header("文件信息 (File Information)")
    
    print(f"\n文件名 (Filename): {filename}")
    print(f"通道数量 (Number of channels): {len(raw.ch_names)}")
    print(f"采样频率 (Sampling frequency): {raw.info['sfreq']} Hz")
    print(f"采样点数 (Number of samples): {raw.n_times:,}")
    
    duration_sec = raw.times[-1]
    duration_min = duration_sec / 60
    duration_hr = duration_min / 60
    print(f"记录时长 (Duration): {duration_sec:.2f} 秒 (seconds)")
    print(f"                 = {duration_min:.2f} 分钟 (minutes)")
    if duration_hr > 1:
        print(f"                 = {duration_hr:.2f} 小时 (hours)")
    
    # 内存估算
    n_samples = raw.n_times
    n_channels = len(raw.ch_names)
    memory_mb = (n_samples * n_channels * 4) / (1024**2)  # float32
    print(f"\n内存估算 (Memory estimate): ~{memory_mb:.1f} MB (如果加载到内存)")
    
    print_header("元数据 (Metadata)")
    
    # 测量日期
    meas_date = raw.info.get('meas_date')
    if meas_date:
        print(f"测量日期 (Measurement date): {meas_date}")
    else:
        print(f"测量日期 (Measurement date): 未知")
    
    # 设备信息
    device_info = raw.info.get('device_info')
    if device_info:
        device_type = device_info.get('type', 'Unknown')
        print(f"设备类型 (Device type): {device_type}")
    
    # 注释数量
    n_annotations = len(raw.annotations)
    print(f"注释数量 (Number of annotations): {n_annotations}")
    
    # 受试者信息
    subject_info = raw.info.get('subject_info')
    if subject_info:
        print("\n受试者信息 (Subject Information):")
        his_id = subject_info.get('his_id', 'Unknown')
        sex = subject_info.get('sex', 'Unknown')
        age = subject_info.get('age', 'Unknown')
        
        sex_map = {0: '未知 (Unknown)', 1: '男 (Male)', 2: '女 (Female)'}
        sex_str = sex_map.get(sex, str(sex))
        
        print(f"  ID: {his_id}")
        print(f"  性别 (Sex): {sex_str}")
        if age != 'Unknown':
            print(f"  年龄 (Age): {age}")


def print_channels(raw: mne.io.Raw, max_display: int = 20):
    """打印通道信息"""
    print_header("通道列表 (Channel List)")
    
    ch_types = raw.get_channel_types()
    n_channels = len(raw.ch_names)
    
    # 按类型分组
    channels_by_type = {}
    for ch, ch_type in zip(raw.ch_names, ch_types):
        if ch_type not in channels_by_type:
            channels_by_type[ch_type] = []
        channels_by_type[ch_type].append(ch)
    
    # 打印每种类型的通道
    for ch_type, channels in channels_by_type.items():
        print(f"\n{ch_type.upper()} ({len(channels)} channels):")
        
        if len(channels) <= max_display:
            for i, ch in enumerate(channels, 1):
                print(f"  {i:2d}. {ch}")
        else:
            for i, ch in enumerate(channels[:max_display], 1):
                print(f"  {i:2d}. {ch}")
            print(f"  ... 还有 {len(channels) - max_display} 个通道")
    
    print(f"\n总计 (Total): {n_channels} channels")


def load_edf_file(filepath: str):
    """加载EDF文件"""
    print(f"\n正在加载文件 (Loading file): {filepath}")
    print("请稍候... (Please wait...)")
    
    try:
        # 使用latin1编码处理中文字符
        # preload=False 可以节省内存，只在需要时加载数据
        raw = mne.io.read_raw_edf(
            filepath,
            preload=False,
            encoding='latin1',
            verbose=False
        )
        print("✓ 加载成功! (Loading successful!)\n")
        return raw
        
    except FileNotFoundError:
        print(f"✗ 错误: 文件不存在 (File not found): {filepath}")
        return None
    except UnicodeDecodeError:
        print(f"✗ 错误: 编码问题，请确保使用正确的编码")
        return None
    except Exception as e:
        print(f"✗ 错误 (Error): {e}")
        return None


def plot_eeg_data(raw: mne.io.Raw, 
                  n_channels: int = 10,
                  duration: float = 10.0,
                  start_time: float = 0.0,
                  scalings: float = 100e-6):
    """绘制EEG数据"""
    
    print_header("绘制波形 (Plotting Waveforms)")
    print(f"显示前 {n_channels} 个EEG通道")
    print(f"Showing first {n_channels} EEG channels")
    print(f"时间窗口 (Time window): {start_time:.1f}s - {start_time + duration:.1f}s")
    print(f"缩放 (Scaling): {scalings*1e6:.0f} µV")
    
    # 复制数据以避免修改原始对象
    raw_plot = raw.copy()
    
    # 裁剪到指定的时间范围
    raw_plot.crop(tmin=start_time, tmax=start_time + duration)
    
    # 加载数据到内存
    print("\n正在加载数据到内存... (Loading data into memory...)")
    raw_plot.load_data()
    
    # 只选择EEG通道
    eeg_picks = mne.pick_types(raw_plot.info, eeg=True)
    
    if len(eeg_picks) == 0:
        print("警告: 未找到EEG通道 (Warning: No EEG channels found)")
        print("尝试显示所有通道... (Showing all channels...)")
        eeg_picks = list(range(len(raw_plot.ch_names)))
    
    # 限制显示的通道数量
    n_channels = min(n_channels, len(eeg_picks))
    eeg_picks = eeg_picks[:n_channels]
    raw_plot.pick_channels([raw_plot.ch_names[i] for i in eeg_picks])
    
    # 创建图形
    print(f"正在创建图形... (Creating plot...)")
    
    # 设置中文字体
    plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
    plt.rcParams['axes.unicode_minus'] = False
    
    fig = raw_plot.plot(
        duration=duration,
        n_channels=n_channels,
        scalings=dict(eeg=scalings),
        title=f'EEG波形 (EEG Waveforms) - {n_channels} Channels',
        show=False,
        block=False
    )
    
    print("✓ 图形已创建! (Plot created!)\n")
    print("提示 (Tips):")
    print("  - 图形窗口将自动打开")
    print("  - 使用鼠标滚轮缩放")
    print("  - 点击并拖动可以平移")
    print("  - 按 's' 可以保存图像")
    print("  - 关闭窗口继续程序")
    
    return fig


def interactive_menu(raw: mne.io.Raw, filename: str):
    """交互式菜单"""
    
    while True:
        print_header("交互式菜单 (Interactive Menu)")
        print("\n请选择操作 (Please select an action):")
        print("  1. 显示元数据 (Show metadata)")
        print("  2. 显示通道列表 (Show channel list)")
        print("  3. 绘制波形图 (Plot waveforms)")
        print("  4. 退出 (Exit)")
        
        choice = input("\n请输入选项 (Enter option) [1-4]: ").strip()
        
        if choice == '1':
            print_metadata(raw, filename)
        
        elif choice == '2':
            print_channels(raw)
        
        elif choice == '3':
            print("\n绘图选项 (Plotting options):")
            print(f"  通道数 (Number of channels) [10]: ", end='')
            n_ch = input().strip()
            n_channels = int(n_ch) if n_ch else 10
            
            print(f"  时长（秒）(Duration in seconds) [10]: ", end='')
            dur = input().strip()
            duration = float(dur) if dur else 10.0
            
            print(f"  起始时间（秒）(Start time in seconds) [0]: ", end='')
            start = input().strip()
            start_time = float(start) if start else 0.0
            
            fig = plot_eeg_data(raw, n_channels, duration, start_time)
            plt.show()
        
        elif choice == '4':
            print("\n退出程序... (Exiting...)")
            break
        
        else:
            print("\n✗ 无效选项，请重试 (Invalid option, please retry)")


def main():
    """主函数"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          EDF 文件查看器 (EDF File Viewer)                ║
║                                                           ║
║      用于读取和可视化 EEG/脑电图数据                     ║
║      (For reading and visualizing EEG data)              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    # 检查命令行参数
    if len(sys.argv) < 2:
        print("用法 (Usage): python edf_demo.py <edf_file>")
        print("\n或指定文件路径:")
        print("Or specify file path:")
        
        # 如果没有参数，尝试查找EDF文件
        edf_dir = Path("./edf")
        if edf_dir.exists():
            edf_files = list(edf_dir.glob("*.edf"))
            if edf_files:
                print(f"\n找到以下EDF文件 (Found EDF files):")
                for i, f in enumerate(edf_files, 1):
                    size_mb = f.stat().st_size / (1024**2)
                    print(f"  {i}. {f.name} ({size_mb:.1f} MB)")
                
                choice = input("\n请选择文件 (Select file) [1]: ").strip()
                if not choice:
                    choice = "1"
                
                try:
                    idx = int(choice) - 1
                    if 0 <= idx < len(edf_files):
                        filepath = str(edf_files[idx])
                    else:
                        print("✗ 无效选择 (Invalid choice)")
                        return
                except ValueError:
                    print("✗ 无效输入 (Invalid input)")
                    return
            else:
                print(f"✗ 在 {edf_dir} 目录中未找到EDF文件")
                return
        else:
            print("✗ 未找到 ./edf 目录")
            return
    else:
        filepath = sys.argv[1]
    
    # 加载文件
    raw = load_edf_file(filepath)
    
    if raw is None:
        return
    
    # 自动显示基本信息
    print_metadata(raw, filepath)
    print_channels(raw)
    
    # 进入交互式菜单
    interactive_menu(raw, filepath)


if __name__ == "__main__":
    main()
