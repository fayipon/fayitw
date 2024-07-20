<?php

// 读取 .env 文件的内容并解析为数组
function loadEnv($path)
{
    if (!file_exists($path)) {
        throw new Exception("The .env file does not exist.");
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $env = [];

    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        if (!empty($name)) {
            $env[$name] = $value;
        }
    }

    return $env;
}

// 加载 .env 文件
$env = loadEnv(__DIR__ . '/.env');

// 读取 Telegram Bot API 令牌
$apiToken = $env['TELEGRAM_BOT_API_TOKEN'];

// 从 Telegram 收到的数据
$update = file_get_contents("php://input");
$update = json_decode($update, TRUE);

// 检查更新类型并提取聊天 ID
if (isset($update["message"])) {
    $chatId = $update["message"]["chat"]["id"];
    $message = $update["message"]["text"];
    // 记录聊天 ID 到日志文件
    file_put_contents("chat_ids.log", "Chat ID: " . $chatId . "\n", FILE_APPEND);
    // 定义回复消息
    $response = "This group's chat ID is: " . $chatId;
    // 发送回复消息
    file_get_contents("https://api.telegram.org/bot$apiToken/sendMessage?chat_id=$chatId&text=" . urlencode($response));
}

?>