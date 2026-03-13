In OpenClaw, sessions starting with subagent, instead of defaul setting which is 'Agent',  automatically trigger a "Minimal" prompt mode.

This "Minimal" mode is much more aggressive than just disabling skills:

It skips the massive general instruction sections.
It skips the documentation injection.
It skips most tool summaries.

I could start antigravity as a agent manually
uv run antigravity_chat.py --provider llamacpp --model qwen3 --message "Hello, who are you"
[ ] how to ask opencraw to create tool using python then then exeucute the tool
    -- Subagent doesn't have tool calls ability.


antigravity_chat.py is valueable on finding out how openclaw works.