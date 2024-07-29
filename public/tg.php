<?php

// 从 Telegram 收到的数据
$update = file_get_contents("php://input");
$update = json_decode($update, TRUE);


// 检查更新类型并提取聊天 ID
if (isset($update["message"])) {
    $chatId = $update["message"]["chat"]["id"];
    $message = $update["message"]["text"];
    // 定义回复消息
    $response = "This group's chat ID is: " . $chatId;

	if ($message == "/start") {
    	// 发送回复消息
    	file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=$chatId&text=" . urlencode($response));		
	}
}

?>