<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

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
        $default_rate = 0.01;
        $mode = 0;

        $time_type = $reponse['type'];

        $reponse['ticker']  = str_replace([".P"], [""], $reponse['ticker']);
        $ticker_boinnance = $reponse['ticker'];

        // 判斷信號為做多或空
        if ($reponse['close'] >= $reponse['open']) {
            $reponse['type'] = "做多";
            $rate = 1 - $default_rate;
            $reponse['ticker'] = "↗︎ " . $reponse['ticker'];
            $mode = 1;
        } else {
            $reponse['type'] = "做空";
            $rate = 1 + $default_rate;
            $reponse['ticker'] = "↘︎ " . $reponse['ticker'];
            $mode = 0;
        }

        // 取得當前資料
        $result = Stock::where('name',$ticker_boinnance)->first();
        if ($result === false) {
            dd($result);
        }

        // 組合發送資料
        $this->send($reponse, $time_type, $binance_tradingview);

        // 更新資料
        if ($time_type == 1) {
            // 1h線
            $result = Stock::where('name',$ticker_boinnance)->update([
                '1h' => $mode,
                'updated_at' => date("Y-m-d H:i:s")
            ]);
            if ($result === false) {
                dd($result);
            }
        } else {
            // 4h線
            $result = Stock::where('name',$ticker_boinnance)->update([
                '4h' => $mode,
                'updated_at' => date("Y-m-d H:i:s")
            ]);
            if ($result === false) {
                dd($result);
            }
        }

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
        
        // 群
        // file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=-4264595778&text=" . urlencode($message));

    }
    
}
