"""
检查账号封禁状态
通过检查邮箱是否收到 AWS 封禁通知邮件来判断账号是否被封禁
"""

import json
import os
import sys
import time
from gptmail_service import GPTMailHandler


def load_accounts(json_file: str) -> list:
    """加载账号列表"""
    if not os.path.exists(json_file):
        print(f"❌ 文件不存在: {json_file}")
        return []
    with open(json_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_ban_email(mail_handler: GPTMailHandler, email: str) -> dict:
    """检查邮箱是否有封禁邮件
    
    AWS/Kiro 封禁邮件特征：
    - 发件人: no-reply@amazonaws.com
    - 主题: Response Required: Your Kiro Account
    - 内容: suspicious activity, restricted your ability
    
    Returns:
        {'banned': bool, 'reason': str, 'subject': str}
    """
    # 封禁邮件特征
    ban_subjects = [
        'response required',
        'account suspended',
        'account terminated',
        'account disabled',
    ]
    ban_content_keywords = [
        'suspicious activity',
        'restricted your ability',
        'we have restricted',
        'account has been suspended',
        'account has been terminated',
        'violation of',
        'abuse',
    ]
    ban_senders = [
        'no-reply@amazonaws.com',
        'noreply@amazonaws.com',
    ]
    
    try:
        emails = mail_handler.get_emails(email)
        for mail in emails:
            from_addr = mail.get('from_address', '').lower()
            subject = mail.get('subject', '').lower()
            html = mail.get('html_content', '').lower()
            
            # 检查发件人 + 主题
            is_aws_sender = any(s in from_addr for s in ban_senders)
            has_ban_subject = any(s in subject for s in ban_subjects)
            has_ban_content = any(k in html for k in ban_content_keywords)
            
            if is_aws_sender and (has_ban_subject or has_ban_content):
                return {
                    'banned': True,
                    'reason': 'AWS 封禁通知',
                    'subject': mail.get('subject', '')[:60]
                }
        return {'banned': False, 'reason': '', 'subject': ''}
    except Exception as e:
        return {'banned': False, 'reason': f'检查失败: {e}', 'subject': ''}


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    registered_file = os.path.join(script_dir, 'registered_accounts.json')
    verified_file = os.path.join(script_dir, 'verified_accounts.json')
    
    # 支持命令行指定文件
    json_file = registered_file
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    
    # 检查两个文件
    files_to_check = []
    if os.path.exists(registered_file):
        files_to_check.append(('registered_accounts.json', registered_file))
    if os.path.exists(verified_file):
        files_to_check.append(('verified_accounts.json', verified_file))
    
    if not files_to_check:
        print("没有账号需要检查")
        return
    
    mail_handler = GPTMailHandler()
    total_banned = 0
    total_normal = 0
    
    for file_name, file_path in files_to_check:
        accounts = load_accounts(file_path)
        if not accounts:
            continue
        
        print(f"\n📋 检查 {file_name}: {len(accounts)} 个账号")
        print("=" * 50)
        
        banned_accounts = []
        normal_accounts = []
        
        for i, acc in enumerate(accounts, 1):
            email = acc.get('email', '')
            if not email:
                continue
            
            print(f"[{i}/{len(accounts)}] 检查: {email}", end=' ... ')
            result = check_ban_email(mail_handler, email)
            
            if result['banned']:
                print(f"🚫 已封禁 ({result['reason']})")
                banned_accounts.append(acc)
            else:
                print("✅ 正常")
                normal_accounts.append(acc)
            
            time.sleep(0.5)
        
        # 处理 registered_accounts.json
        if file_name == 'registered_accounts.json':
            # 正常账号添加到 verified
            if normal_accounts:
                existing = load_accounts(verified_file)
                existing_emails = {a.get('email') for a in existing}
                
                new_count = 0
                for acc in normal_accounts:
                    if acc.get('email') not in existing_emails:
                        existing.append(acc)
                        new_count += 1
                
                with open(verified_file, 'w', encoding='utf-8') as f:
                    json.dump(existing, f, indent=2, ensure_ascii=False)
                
                if new_count > 0:
                    print(f"✅ 已将 {new_count} 个正常账号添加到 verified_accounts.json")
            
            # 清空 registered（所有已处理的都移除）
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2, ensure_ascii=False)
            print(f"🗑️  已清空 {file_name}")
        
        # 处理 verified_accounts.json - 只保留正常账号
        elif file_name == 'verified_accounts.json':
            if banned_accounts:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(normal_accounts, f, indent=2, ensure_ascii=False)
                print(f"🗑️  已从 {file_name} 移除 {len(banned_accounts)} 个封禁账号")
        
        total_banned += len(banned_accounts)
        total_normal += len(normal_accounts)
        
        if banned_accounts:
            print(f"\n🚫 {file_name} 封禁账号:")
            for acc in banned_accounts:
                print(f"  - {acc.get('email')}")
    
    mail_handler.close()
    
    # 输出总统计
    print("\n" + "=" * 50)
    print(f"📊 总计: 正常 {total_normal}, 封禁 {total_banned}")


if __name__ == '__main__':
    main()
