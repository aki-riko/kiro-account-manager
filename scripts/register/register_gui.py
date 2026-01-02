"""
Amazon Q Developer 批量注册 GUI (统一版)
支持多种自动化技术：SeleniumBase SB、SeleniumBase Driver、Playwright、Pyppeteer、DrissionPage

依赖安装: pip install ttkbootstrap
"""

import sys
import os

import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from ttkbootstrap.widgets.scrolled import ScrolledText
from ttkbootstrap.dialogs import Messagebox
import threading
import json
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
ACCOUNTS_FILE = os.path.join(SCRIPT_DIR, "registered_accounts.json")

# 可用的自动化技术
TECH_OPTIONS = {
    "SeleniumBase SB": {
        "module": "amazonq_auto_register_sb",
        "desc": "SB 上下文管理器，反检测强",
        "headless_support": True,
    },
    "SeleniumBase Driver": {
        "module": "amazonq_auto_register_driver",
        "desc": "Driver 类，Windows 无头模式受限",
        "headless_support": False,  # Windows UC 模式不支持无头
    },
    "Playwright": {
        "module": "amazonq_auto_register_playwright",
        "desc": "微软出品，API 现代化",
        "headless_support": True,
    },
    "Pyppeteer": {
        "module": "amazonq_auto_register_pyppeteer",
        "desc": "Puppeteer Python 版，异步",
        "headless_support": True,
    },
    "DrissionPage": {
        "module": "amazonq_auto_register_drission",
        "desc": "国产库，自带反检测",
        "headless_support": True,
    },
    # Protocol 版本已移除 - AWS 注册流程是 SPA + 表单，纯 HTTP 无法实现
}


class StdoutRedirector:
    """重定向 stdout/stderr 到 GUI 日志"""
    def __init__(self, gui):
        self.gui = gui
    
    def write(self, text):
        if text.strip():
            # 同时打印到控制台（保留换行）
            sys.__stdout__.write(text if text.endswith('\n') else text + '\n')
            sys.__stdout__.flush()
            self.gui.root.after(0, lambda t=text.rstrip(): self.gui.log(t))
    
    def flush(self):
        pass


class RegisterGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Amazon Q Developer 批量注册")
        self.root.geometry("750x650")
        self.root.resizable(True, True)
        
        self.is_running = False
        self.success_count = 0
        self.fail_count = 0
        self.total_count = 0
        
        self.setup_ui()
        self.update_account_count()
    
    def setup_ui(self):
        # 主容器
        main_frame = ttk.Frame(self.root, padding=15)
        main_frame.pack(fill=BOTH, expand=YES)
        
        # 标题
        title_label = ttk.Label(
            main_frame, 
            text="🤖 Amazon Q Developer 批量注册",
            font=("Microsoft YaHei", 16, "bold"),
            bootstyle="primary"
        )
        title_label.pack(pady=(0, 15))
        
        # 配置区域
        config_frame = ttk.Labelframe(main_frame, text="注册配置", padding=15, bootstyle="primary")
        config_frame.pack(fill=X, pady=(0, 10))
        
        # 第一行：技术选择
        row0 = ttk.Frame(config_frame)
        row0.pack(fill=X, pady=5)
        
        ttk.Label(row0, text="自动化技术:", width=10).pack(side=LEFT)
        self.tech_var = ttk.StringVar(value="Playwright")
        self.tech_combo = ttk.Combobox(
            row0, 
            textvariable=self.tech_var,
            values=list(TECH_OPTIONS.keys()),
            state="readonly",
            width=20,
            bootstyle="primary"
        )
        self.tech_combo.pack(side=LEFT, padx=(0, 10))
        self.tech_combo.bind("<<ComboboxSelected>>", self.on_tech_change)
        
        self.tech_desc_label = ttk.Label(
            row0, 
            text=TECH_OPTIONS["Playwright"]["desc"],
            font=("Microsoft YaHei", 9),
            bootstyle="secondary"
        )
        self.tech_desc_label.pack(side=LEFT, padx=10)
        
        # 第二行：数量和无头模式
        row1 = ttk.Frame(config_frame)
        row1.pack(fill=X, pady=5)
        
        ttk.Label(row1, text="注册数量:", width=10).pack(side=LEFT)
        self.count_var = ttk.IntVar(value=1)
        self.count_spin = ttk.Spinbox(row1, from_=1, to=100, width=8, textvariable=self.count_var, bootstyle="primary")
        self.count_spin.pack(side=LEFT, padx=(0, 20))
        
        # 无头模式 - 从 config 读取默认值
        from config import HEADLESS_MODE as DEFAULT_HEADLESS
        self.headless_var = ttk.BooleanVar(value=DEFAULT_HEADLESS)
        self.headless_check = ttk.Checkbutton(
            row1, text="无头模式", variable=self.headless_var,
            bootstyle="primary-round-toggle"
        )
        self.headless_check.pack(side=LEFT, padx=10)
        
        # 第三行：账号统计
        row2 = ttk.Frame(config_frame)
        row2.pack(fill=X, pady=5)
        
        self.account_label = ttk.Label(row2, text="📁 已注册账号: 0 个", font=("Microsoft YaHei", 10))
        self.account_label.pack(side=LEFT)
        
        self.verified_label = ttk.Label(row2, text="✅ 已验证: 0 个", font=("Microsoft YaHei", 10))
        self.verified_label.pack(side=LEFT, padx=20)

        # 按钮区域
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=X, pady=10)
        
        self.start_btn = ttk.Button(
            btn_frame, text="🚀 开始注册", 
            command=self.start_register,
            bootstyle="success",
            width=12
        )
        self.start_btn.pack(side=LEFT, padx=5)
        
        self.stop_btn = ttk.Button(
            btn_frame, text="⏹ 停止", 
            command=self.stop_register,
            bootstyle="danger",
            width=8,
            state=DISABLED
        )
        self.stop_btn.pack(side=LEFT, padx=5)
        
        ttk.Button(
            btn_frame, text="🔍 检查封禁",
            command=self.check_banned,
            bootstyle="danger-outline",
            width=10
        ).pack(side=LEFT, padx=5)
        
        ttk.Button(
            btn_frame, text="📥 导入管理器",
            command=self.import_to_manager,
            bootstyle="warning-outline",
            width=12
        ).pack(side=LEFT, padx=5)
        
        ttk.Button(
            btn_frame, text="🔄 刷新",
            command=self.update_account_count,
            bootstyle="secondary-outline",
            width=6
        ).pack(side=LEFT, padx=5)
        
        # 进度区域
        progress_frame = ttk.Labelframe(main_frame, text="运行进度", padding=10, bootstyle="info")
        progress_frame.pack(fill=X, pady=(0, 10))
        
        # 进度条
        self.progress_var = ttk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(
            progress_frame, 
            variable=self.progress_var,
            bootstyle="success-striped",
            length=400
        )
        self.progress_bar.pack(fill=X, pady=5)
        
        # 进度统计
        stats_frame = ttk.Frame(progress_frame)
        stats_frame.pack(fill=X)
        
        self.progress_label = ttk.Label(
            stats_frame, 
            text="就绪",
            font=("Microsoft YaHei", 10)
        )
        self.progress_label.pack(side=LEFT)
        
        self.stats_label = ttk.Label(
            stats_frame,
            text="✅ 0  ❌ 0",
            font=("Microsoft YaHei", 10, "bold")
        )
        self.stats_label.pack(side=RIGHT)
        
        # 日志区域
        log_frame = ttk.Labelframe(main_frame, text="运行日志", padding=5, bootstyle="secondary")
        log_frame.pack(fill=BOTH, expand=YES)
        
        self.log_text = ScrolledText(log_frame, height=15, autohide=True)
        self.log_text.pack(fill=BOTH, expand=YES)
    
    def on_tech_change(self, event=None):
        """技术选择变化"""
        tech = self.tech_var.get()
        if tech in TECH_OPTIONS:
            self.tech_desc_label.config(text=TECH_OPTIONS[tech]["desc"])
            # 不支持无头模式时禁用复选框
            if not TECH_OPTIONS[tech]["headless_support"]:
                self.headless_var.set(False)
                self.headless_check.config(state=DISABLED)
            else:
                self.headless_check.config(state=NORMAL)
    
    def log(self, message):
        """添加日志"""
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.insert(END, f"[{timestamp}] {message}\n")
        self.log_text.see(END)
        self.root.update_idletasks()
    
    def update_account_count(self):
        """更新账号数量"""
        # 已注册账号
        count = 0
        if os.path.exists(ACCOUNTS_FILE):
            try:
                with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                    count = len(json.load(f))
            except:
                pass
        self.account_label.config(text=f"📁 已注册账号: {count} 个")
        
        # 已验证账号
        verified_file = os.path.join(SCRIPT_DIR, "verified_accounts.json")
        verified_count = 0
        if os.path.exists(verified_file):
            try:
                with open(verified_file, 'r', encoding='utf-8') as f:
                    verified_count = len(json.load(f))
            except:
                pass
        self.verified_label.config(text=f"✅ 已验证: {verified_count} 个")
    
    def check_banned(self):
        """检查被封禁的账号"""
        if self.is_running:
            Messagebox.show_warning("请等待当前任务完成", title="提示")
            return
        
        if not os.path.exists(ACCOUNTS_FILE):
            Messagebox.show_warning("没有可检查的账号", title="提示")
            return
        
        self.is_running = True
        self.log_text.delete(1.0, END)
        thread = threading.Thread(target=self.run_check_banned, daemon=True)
        thread.start()
    
    def run_check_banned(self):
        """运行封禁检查任务"""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirector = StdoutRedirector(self)
        sys.stdout = redirector
        sys.stderr = redirector
        
        try:
            from check_ban import main as check_main
            check_main()
        except Exception as e:
            print(f"❌ 检查出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            self.is_running = False
            self.root.after(0, self.update_account_count)
    
    def import_to_manager(self):
        """导入账号到 kiro-account-manager"""
        if self.is_running:
            Messagebox.show_warning("请等待当前任务完成", title="提示")
            return
        
        # 优先导入已验证账号
        verified_file = os.path.join(SCRIPT_DIR, "verified_accounts.json")
        source_file = verified_file if os.path.exists(verified_file) else ACCOUNTS_FILE
        
        if not os.path.exists(source_file):
            Messagebox.show_warning("没有可导入的账号", title="提示")
            return
        
        self.is_running = True
        self.log_text.delete(1.0, END)
        
        source_name = "verified_accounts.json" if source_file == verified_file else "registered_accounts.json"
        thread = threading.Thread(target=self.run_import, args=(source_name,), daemon=True)
        thread.start()
    
    def run_import(self, source_filename):
        """运行导入任务"""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirector = StdoutRedirector(self)
        sys.stdout = redirector
        sys.stderr = redirector
        
        try:
            from import_registered import main as import_main
            import_main(max_workers=5, source_filename=source_filename)
        except Exception as e:
            print(f"❌ 导入出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            self.is_running = False
            self.root.after(0, self.update_account_count)

    def update_progress(self):
        """更新进度显示"""
        completed = self.success_count + self.fail_count
        if self.total_count > 0:
            progress = (completed / self.total_count) * 100
            self.progress_var.set(progress)
        
        self.progress_label.config(text=f"进度: {completed}/{self.total_count}")
        self.stats_label.config(text=f"✅ {self.success_count}  ❌ {self.fail_count}")
    
    def start_register(self):
        """开始注册"""
        if self.is_running:
            return
        
        try:
            count = self.count_var.get()
            
            if count <= 0:
                Messagebox.show_error("数量必须大于 0", title="错误")
                return
            
            # 根据账号数量自动设置并发数
            if count <= 2:
                concurrent = 1
            elif count <= 5:
                concurrent = 2
            elif count <= 10:
                concurrent = 3
            else:
                concurrent = 5
        except:
            Messagebox.show_error("请输入有效数字", title="错误")
            return
        
        # 重置状态
        self.is_running = True
        self.success_count = 0
        self.fail_count = 0
        self.total_count = count
        self.progress_var.set(0)
        
        self.start_btn.config(state=DISABLED)
        self.stop_btn.config(state=NORMAL)
        self.log_text.delete(1.0, END)
        
        headless = self.headless_var.get()
        tech = self.tech_var.get()
        thread = threading.Thread(target=self.run_register, args=(count, concurrent, headless, tech), daemon=True)
        thread.start()
    
    def stop_register(self):
        """停止注册"""
        self.is_running = False
        self.log("⚠️ 用户请求停止，等待当前任务完成...")

    def run_register(self, count, concurrent, headless, tech):
        """运行注册任务"""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirector = StdoutRedirector(self)
        sys.stdout = redirector
        sys.stderr = redirector
        
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import importlib
            
            # 动态导入选择的模块
            module_name = TECH_OPTIONS[tech]["module"]
            module = importlib.import_module(module_name)
            register_func = module.register_single_account
            set_headless = module.set_headless_mode
            
            set_headless(headless)
            
            mode_text = "无头模式" if headless else "有头模式"
            print(f"🚀 开始批量注册: {count} 个账号, 并发 {concurrent} 窗口, {mode_text}")
            print(f"📦 使用技术: {tech}")
            print("=" * 50)
            
            result_lock = threading.Lock()
            
            def process_one(account_num):
                if not self.is_running:
                    return False
                
                print(f"🔄 [窗口 {account_num}] 开始注册...")
                
                try:
                    result = register_func(account_num, count)
                    with result_lock:
                        if result:
                            self.success_count += 1
                            print(f"✅ [窗口 {account_num}] 注册成功")
                        else:
                            self.fail_count += 1
                            print(f"❌ [窗口 {account_num}] 注册失败")
                        self.root.after(0, self.update_progress)
                    return result
                except Exception as e:
                    with result_lock:
                        self.fail_count += 1
                        self.root.after(0, self.update_progress)
                    print(f"❌ [窗口 {account_num}] 出错: {e}")
                    import traceback
                    traceback.print_exc()
                    return False
            
            with ThreadPoolExecutor(max_workers=concurrent) as executor:
                futures = {executor.submit(process_one, i): i for i in range(1, count + 1)}
                
                for future in as_completed(futures):
                    if not self.is_running:
                        break
                    try:
                        future.result()
                    except Exception as e:
                        print(f"❌ 执行异常: {e}")
            
            print("=" * 50)
            print(f"🎉 注册完成: 成功 {self.success_count}, 失败 {self.fail_count}")
            
        except Exception as e:
            print(f"❌ 运行出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            self.is_running = False
            self.root.after(0, self.on_register_complete)
    
    def on_register_complete(self):
        """注册完成回调"""
        self.start_btn.config(state=NORMAL)
        self.stop_btn.config(state=DISABLED)
        self.update_account_count()
        
        if self.success_count > 0:
            self.progress_bar.configure(bootstyle="success")
        elif self.fail_count > 0:
            self.progress_bar.configure(bootstyle="danger")


def main():
    root = ttk.Window(themename="darkly")
    app = RegisterGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
