<?php

// 读取 Telegram Bot API 令牌
$apiToken = "7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU";

// 从 Telegram 收到的数据
$update = file_get_contents("php://input");
$update = json_decode($update, TRUE);

// 提取消息中的聊天 ID 和文本
$chatId = $update["message"]["chat"]["id"];
$message = $update["message"]["text"];

// 定义回复消息
$response = "You said: " . $message;

// 发送回复消息
file_get_contents("https://api.telegram.org/bot$apiToken/sendMessage?chat_id=$chatId&text=" . urlencode($response));

?>