"""
实验运行器模块

提供统一的入口点运行所有实验套件。
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import json
from datetime import datetime
import argparse

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from exp.experiments.experiment_artifacts import ArtifactExperiments
from exp.experiments.experiment_drift import DriftExperiments
from exp.experiments.experiment_eeg_events import EEGEventExperiments


class ExperimentRunner:
    """统一实验运行器

    提供便捷的接口运行所有或部分实验套件，并生成汇总报告。
    """

    def __init__(self, base_report_dir: str = None, sfreq: float = 500.0):
        """
        初始化实验运行器

        Args:
            base_report_dir: 基础报告目录
            sfreq: 采样率
        """
        self.sfreq = sfreq
        self.base_report_dir = Path(base_report_dir) if base_report_dir else Path(__file__).parent.parent / "reports"
        self.base_report_dir.mkdir(parents=True, exist_ok=True)

        # 初始化各实验套件
        self.artifact_experiments = ArtifactExperiments(sfreq, str(self.base_report_dir / "artifacts"))
        self.drift_experiments = DriftExperiments(sfreq, str(self.base_report_dir / "drift"))
        self.eeg_event_experiments = EEGEventExperiments(sfreq, str(self.base_report_dir / "eeg_events"))

    def run_all_experiments(self, quick_mode: bool = False) -> Dict[str, Any]:
        """
        运行所有实验套件

        Args:
            quick_mode: 快速模式，运行部分测试用例

        Returns:
            所有实验的汇总结果
        """
        print("\n" + "=" * 100)
        print(" " * 35 + "运行完整实验套件")
        print("=" * 100)
        print(f"报告目录: {self.base_report_dir}")
        print(f"采样率: {self.sfreq} Hz")
        print(f"快速模式: {quick_mode}")
        print("=" * 100)

        all_results = {
            "timestamp": datetime.now().isoformat(),
            "sfreq": self.sfreq,
            "quick_mode": quick_mode
        }

        # 1. 伪迹信号实验
        print("\n【1/6】伪迹信号实验...")
        try:
            if quick_mode:
                all_results["artifacts"] = self.artifact_experiments.run_baseline_wander_experiment(
                    amplitudes=[20, 50], freqs=[0.1, 0.2]
                )
            else:
                all_results["artifacts"] = self.artifact_experiments.run_full_suite()
        except Exception as e:
            print(f"伪迹信号实验失败: {e}")
            all_results["artifacts"] = {"error": str(e)}

        # 2. 漂移信号实验
        print("\n【2/6】漂移信号实验...")
        try:
            if quick_mode:
                all_results["drift"] = {
                    "linear_drift": self.drift_experiments.run_linear_drift_experiment(
                        slopes=[5, 20], base_frequencies=[10]
                    ),
                    "combined_drift": self.drift_experiments.run_combined_drift_experiment(
                        a_values=[10, 50], b_values=[5, 20]
                    )
                }
            else:
                all_results["drift"] = self.drift_experiments.run_full_suite()
        except Exception as e:
            print(f"漂移信号实验失败: {e}")
            all_results["drift"] = {"error": str(e)}

        # 3. EEG 事件实验
        print("\n【3/6】EEG 事件实验...")
        try:
            if quick_mode:
                all_results["eeg_events"] = {
                    "sleep_spindle": self.eeg_event_experiments.run_sleep_spindle_experiment(
                        durations=[1.0], center_freqs=[13.0], amplitudes=[50]
                    ),
                    "background_eeg": self.eeg_event_experiments.run_background_eeg_experiment(
                        alpha_freqs=[10.0], durations=[2.0]
                    )
                }
            else:
                all_results["eeg_events"] = self.eeg_event_experiments.run_full_suite()
        except Exception as e:
            print(f"EEG 事件实验失败: {e}")
            all_results["eeg_events"] = {"error": str(e)}

        # 生成总体汇总报告
        self._generate_master_summary(all_results)

        return all_results

    def run_artifact_experiments(self, quick_mode: bool = False) -> Dict[str, Any]:
        """运行伪迹信号实验"""
        if quick_mode:
            return {
                "baseline_wander": self.artifact_experiments.run_baseline_wander_experiment(
                    amplitudes=[20, 50], freqs=[0.1, 0.2]
                )
            }
        else:
            return self.artifact_experiments.run_full_suite()

    def run_drift_experiments(self, quick_mode: bool = False) -> Dict[str, Any]:
        """运行漂移信号实验"""
        if quick_mode:
            return {
                "linear_drift": self.drift_experiments.run_linear_drift_experiment(
                    slopes=[5, 20], base_frequencies=[10]
                ),
                "combined_drift": self.drift_experiments.run_combined_drift_experiment(
                    a_values=[10, 50], b_values=[5, 20]
                )
            }
        else:
            return self.drift_experiments.run_full_suite()

    def run_eeg_event_experiments(self, quick_mode: bool = False) -> Dict[str, Any]:
        """运行 EEG 事件实验"""
        if quick_mode:
            return {
                "sleep_spindle": self.eeg_event_experiments.run_sleep_spindle_experiment(
                    durations=[1.0], center_freqs=[13.0], amplitudes=[50]
                ),
                "background_eeg": self.eeg_event_experiments.run_background_eeg_experiment(
                    alpha_freqs=[10.0], durations=[2.0]
                )
            }
        else:
            return self.eeg_event_experiments.run_full_suite()

    def run_quick_test(self) -> Dict[str, Any]:
        """
        运行快速测试

        使用最小测试用例集合验证实验框架功能

        Returns:
            测试结果摘要
        """
        print("\n" + "=" * 80)
        print(" " * 30 + "快速测试模式 (最小测试集)")
        print("=" * 80)

        results = self.run_all_experiments(quick_mode=True)

        # 计算总体统计
        total_tests = 0
        passed_tests = 0

        for category, cat_results in results.items():
            if isinstance(cat_results, dict) and "error" not in cat_results:
                for exp_name, exp_results in cat_results.items():
                    if isinstance(exp_results, dict) and "results" in exp_results:
                        total_tests += len(exp_results["results"])
                        passed_tests += sum(1 for r in exp_results["results"] if r["passed"])

        print(f"\n总体统计:")
        print(f"  总测试数: {total_tests}")
        print(f"  通过测试: {passed_tests}")
        print(f"  失败测试: {total_tests - passed_tests}")
        print(f"  通过率: {passed_tests/total_tests:.1%}" if total_tests > 0 else "  通过率: N/A")

        return results

    def _generate_master_summary(self, all_results: Dict[str, Any]):
        """生成主汇总报告"""
        summary_lines = [
            "# EEG 分析实验完整报告",
            "",
            f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**采样率**: {all_results.get('sfreq', 500)} Hz",
            f"**快速模式**: {all_results.get('quick_mode', False)}",
            "",
            "## 实验套件概览",
            ""
        ]

        # 计算总体统计
        total_experiments = 0
        passed_experiments = 0

        for category, cat_results in all_results.items():
            if category in ["timestamp", "sfreq", "quick_mode"]:
                continue

            if isinstance(cat_results, dict) and "error" not in cat_results:
                # 单个实验套件
                for exp_name, exp_results in cat_results.items():
                    if isinstance(exp_results, dict) and "pass_rate" in exp_results:
                        total_experiments += 1
                        if exp_results["pass_rate"] >= 0.8:
                            passed_experiments += 1

                        pass_rate = exp_results["pass_rate"]
                        status = "✓ 通过" if pass_rate >= 0.8 else "⚠ 部分" if pass_rate >= 0.5 else "✗ 失败"
                        summary_lines.append(f"- **{category}/{exp_name}**: {status} ({pass_rate:.1%})")
            elif isinstance(cat_results, dict) and "error" in cat_results:
                summary_lines.append(f"- **{category}**: ✗ 失败 - {cat_results['error']}")
                total_experiments += 1

        summary_lines.extend([
            "",
            f"## 总体统计",
            "",
            f"- **实验套件数**: {total_experiments}",
            f"- **完全通过**: {passed_experiments}",
            f"- **部分通过**: {sum(1 for cat in all_results.values() if isinstance(cat, dict) and 'error' not in cat for exp in cat.values() if isinstance(exp, dict) and 0.5 <= exp.get('pass_rate', 0) < 0.8)}",
            f"- **失败**: {sum(1 for cat in all_results.values() if isinstance(cat, dict) and 'error' in cat)}",
            "",
            "## 实验详情",
            ""
        ])

        # 添加详细结果
        for category, cat_results in all_results.items():
            if category in ["timestamp", "sfreq", "quick_mode"]:
                continue

            summary_lines.append(f"### {category.replace('_', ' ').title()}")
            summary_lines.append("")

            if isinstance(cat_results, dict) and "error" not in cat_results:
                for exp_name, exp_results in cat_results.items():
                    if isinstance(exp_results, dict) and "results" in exp_results:
                        summary_lines.append(f"#### {exp_name}")
                        for result in exp_results["results"]:
                            status = "✓" if result["passed"] else "✗"
                            summary_lines.append(f"- {status} {result}")
            elif isinstance(cat_results, dict) and "error" in cat_results:
                summary_lines.append(f"错误: {cat_results['error']}")

            summary_lines.append("")

        # 保存报告
        report_path = self.base_report_dir / "MASTER_SUMMARY.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(summary_lines))

        print(f"\n主汇总报告已保存: {report_path}")

    def save_configuration(self, config: Dict[str, Any]):
        """
        保存实验配置

        Args:
            config: 配置字典
        """
        config_path = self.base_report_dir / "experiment_config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"配置已保存: {config_path}")

    def load_configuration(self) -> Optional[Dict[str, Any]]:
        """
        加载实验配置

        Returns:
            配置字典，如果不存在则返回 None
        """
        config_path = self.base_report_dir / "experiment_config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description="EEG 分析实验运行器")
    parser.add_argument(
        "--mode",
        choices=["all", "artifacts", "drift", "eeg_events", "quick"],
        default="all",
        help="实验模式: all(全部), artifacts(伪迹), drift(漂移), eeg_events(EEG事件), quick(快速测试)"
    )
    parser.add_argument(
        "--sfreq",
        type=float,
        default=500.0,
        help="采样率 (Hz)"
    )
    parser.add_argument(
        "--report-dir",
        type=str,
        default=None,
        help="报告目录"
    )

    args = parser.parse_args()

    # 创建运行器
    runner = ExperimentRunner(
        base_report_dir=args.report_dir,
        sfreq=args.sfreq
    )

    # 根据模式运行实验
    if args.mode == "all":
        results = runner.run_all_experiments(quick_mode=False)
    elif args.mode == "artifacts":
        results = runner.run_artifact_experiments()
    elif args.mode == "drift":
        results = runner.run_drift_experiments()
    elif args.mode == "eeg_events":
        results = runner.run_eeg_event_experiments()
    elif args.mode == "quick":
        results = runner.run_quick_test()

    print("\n实验完成！")
    print(f"报告保存在: {runner.base_report_dir}")


if __name__ == "__main__":
    main()
