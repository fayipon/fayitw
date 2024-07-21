<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Test;
use App\Models\Stock;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);
        $reponse = $this->request;
        date_default_timezone_set("Asia/Taipei");

        // 將傳入資料儲存
        Test::create([
            "data" => json_encode($this->request)
        ]);

        $default_rate = 0.01;

        // 去除TradingView部份參數 帶了.P
        $ticker_tradingview = $reponse['ticker'];
        $reponse['ticker']  = str_replace([".P"], [""], $reponse['ticker']);
        
        // 紀錄時間
        $time_type = $reponse['type'];

        $binance_tradingview = $reponse['ticker'];

        // 判斷信號為做多或空
        if ($reponse['close'] >= $reponse['open']) {
            $reponse['type'] = "做多";
            $rate = 1 - $default_rate;
            $reponse['ticker'] = "↗︎ " . $reponse['ticker'];
        } else {
            $reponse['type'] = "做空";
            $rate = 1 + $default_rate;
            $reponse['ticker'] = "↘︎ " . $reponse['ticker'];
        }

        // 組合發送資料
        $this->send($reponse, $time_type, $binance_tradingview);

        // 更新資料
        Stock::update(
            ['user_id' => $user->id],
            ['token' => $token]
        );

    }

    // send message
    protected function send($reponse,$time_type,$binance_tradingview) {

        $message = $reponse['ticker'] . " " . $time_type . "H " . $reponse['type'] . "
=========================
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "

Binance : https://www.binance.com/zh-TC/futures/" . $binance_tradingview . "
";
        
        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=545205414&text=" . urlencode($message));
    }
    
}
