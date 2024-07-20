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

print_r($env);

?>